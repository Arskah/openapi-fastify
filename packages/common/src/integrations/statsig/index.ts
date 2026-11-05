import { Statsig, StatsigUser, type StatsigResult } from '@statsig/statsig-node-core';
import type { Logger } from '../../logger.ts';
import {
  FLAG_DEFAULTS,
  type FeatureFlagProvider,
  type FlagSubject,
  type FlagValues,
} from '../../ports/feature-flags.ts';

/** How often the SDK re-downloads rules: a change in the Statsig console applies within this. */
const RULES_SYNC_INTERVAL_MS = 10_000;

/** Where each value lives in Statsig: a field of a dynamic config. Gates use their port names. */
const VALUE_SOURCES: { [K in keyof FlagValues]: { config: string; field: string } } = {
  maxTodosPerProject: { config: 'project_limits', field: 'max_todos' },
};

/** Statsig needs a user for every check; global checks (no subject) all use this one. */
const GLOBAL_USER = new StatsigUser({ userID: 'global' });

function userOf(subject: FlagSubject | undefined): StatsigUser {
  return subject ? new StatsigUser({ userID: subject.userId }) : GLOBAL_USER;
}

export interface StatsigOptions {
  serverSecret: string;
  /** Statsig environment tier, e.g. `development`, `staging`, `production`. */
  environment?: string;
  logger: Logger;
}

/**
 * Starts Statsig and adapts it to the `FeatureFlags` port.
 *
 * `initialize()` downloads the rule set, and the SDK re-syncs it in the
 * background every `RULES_SYNC_INTERVAL_MS`. Nothing is cached here: every
 * `isEnabled()` / `value()` call evaluates against the rules the SDK holds at
 * that moment, so flags change at runtime without a restart. If it cannot
 * initialise, it serves defaults (gates off), so the app starts anyway: a flag
 * provider outage must not take the service down.
 *
 * The instance is Statsig's shared one (`Statsig.newShared`), so app code that
 * checks a flag at the edge, outside common's use cases, can reach the same
 * instance with `Statsig.shared()` instead of starting a second one. One per
 * process: starting twice throws, and `shutdown()` releases it.
 */
export async function startStatsig({
  serverSecret,
  environment,
  logger,
}: StatsigOptions): Promise<FeatureFlagProvider> {
  const log = logger.child({ component: 'Statsig' });
  // newShared() on an existing instance only warns and returns a dead one, whose gates are all off
  if (Statsig.hasShared()) throw new Error('Statsig is already started in this process');
  const statsig = Statsig.newShared(serverSecret, {
    environment,
    specsSyncIntervalMs: RULES_SYNC_INTERVAL_MS,
    // The SDK prints its own plain-text lines to stdout. Failures that matter come back as results and
    // are logged below, structured; keep only the SDK's errors (e.g. background sync failing). Its
    // outputLoggerProvider hook would route lines through our logger, but in 0.24.0 it keeps the event
    // loop alive after shutdown(), so the process never exits.
    outputLogLevel: 'error',
  });

  const init = await statsig.initialize();
  if (init.isSuccess) log.info('initialised');
  else log.warn({ error: init.error }, 'failed to initialise; flags use their defaults');

  return {
    isEnabled: (gate, subject) => statsig.checkGate(userOf(subject), gate),
    value: (key, subject) => {
      const { config, field } = VALUE_SOURCES[key];
      // Falls back to the default when the field is missing or of another type
      return statsig.getDynamicConfig(userOf(subject), config).get(field, FLAG_DEFAULTS[key]);
    },
    // Losing exposure events must not fail a request or invocation: log, never throw
    flush: () => settle(statsig.flushEvents(), log, 'failed to flush events'),
    async shutdown() {
      await settle(statsig.shutdown(), log, 'failed to shut down cleanly');
      Statsig.removeSharedInstance();
    },
  };
}

/**
 * Awaits a Statsig call, logs a warning if it failed, and never throws.
 *
 * Statsig reports failure in two ways: a resolved `{ isSuccess: false, error }`
 * (the usual one), or a rejection (unverified; its ErrorBoundary may prevent
 * it). Never throwing matters more than the log: `flush()` runs in the
 * Lambda's `finally` and `shutdown()` in Fastify's `onClose`, where a throw
 * would mask the handler's error, fail a successful SQS batch (redelivery), or
 * skip the rest of shutdown.
 *
 * The SDK logs these failures itself, at WARN, but `outputLogLevel: 'error'`
 * hides them, so this log is the only record. If `outputLoggerProvider` worked
 * (see above), the `isSuccess` check would duplicate the SDK's own log and only
 * the try/catch would be needed: the provider is a log sink and cannot stop a
 * rejection.
 */
async function settle(result: Promise<StatsigResult>, log: Logger, message: string): Promise<void> {
  try {
    const { isSuccess, error } = await result;
    if (!isSuccess) log.warn({ error }, message);
  } catch (err) {
    log.warn({ err }, message);
  }
}
