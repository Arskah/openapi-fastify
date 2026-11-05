import { staticFeatureFlags } from './integrations/static-flags/index.ts';
import { startStatsig } from './integrations/statsig/index.ts';
import type { Logger } from './logger.ts';
import type { FeatureFlagProvider } from './ports/feature-flags.ts';

export interface FeatureFlagsOptions {
  /** Statsig server secret. Without one, flags are static: gates off, default values. */
  statsigServerSecret?: string;
  statsigEnvironment?: string;
  logger: Logger;
}

type Env = Record<string, string | undefined>;

/**
 * Feature flag settings from environment variables. Kept out of `CommonConfig`
 * on purpose: the container exposes its config to use cases, and the secret
 * belongs to the provider alone.
 */
export function featureFlagsFromEnv(env: Env): Omit<FeatureFlagsOptions, 'logger'> {
  return {
    statsigServerSecret: env.STATSIG_SERVER_SECRET || undefined,
    statsigEnvironment: env.STATSIG_ENVIRONMENT || undefined,
  };
}

/**
 * Starts the flag provider. Async, so apps await it before `createContainer`
 * and pass the result in: once it resolves, every flag check is synchronous.
 */
export async function startFeatureFlags({
  statsigServerSecret,
  statsigEnvironment,
  logger,
}: FeatureFlagsOptions): Promise<FeatureFlagProvider> {
  if (!statsigServerSecret) {
    logger.info('STATSIG_SERVER_SECRET not set: feature flags use their defaults');
    return staticFeatureFlags();
  }
  return startStatsig({ serverSecret: statsigServerSecret, environment: statsigEnvironment, logger });
}
