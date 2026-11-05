import { staticFeatureFlags } from './integrations/static-flags/index.ts';
import { startStatsig } from './integrations/statsig/index.ts';
import type { Logger } from './logger.ts';
import type { FeatureFlagProvider } from './ports/feature-flags.ts';
import type { SecretStore } from './ports/secrets.ts';

export interface FeatureFlagsOptions {
  /** ID of the secret holding the Statsig server key. Without one, flags are static: gates off, default values. */
  statsigSecretId?: string;
  statsigEnvironment?: string;
  secrets: SecretStore;
  logger: Logger;
}

type Env = Record<string, string | undefined>;

/**
 * Feature flag settings from environment variables: the secret's ID, never
 * the key itself, which `startFeatureFlags` fetches from the secret store.
 */
export function featureFlagsFromEnv(env: Env): Pick<FeatureFlagsOptions, 'statsigSecretId' | 'statsigEnvironment'> {
  return {
    statsigSecretId: env.STATSIG_SECRET_ID || undefined,
    statsigEnvironment: env.STATSIG_ENVIRONMENT || undefined,
  };
}

/**
 * Starts the flag provider. Async, so apps await it before `createContainer`
 * and pass the result in: once it resolves, every flag check is synchronous.
 *
 * The Statsig key is fetched here and handed to the provider only, so it is
 * never in `CommonConfig`, which the container exposes to use cases. A key
 * that cannot be fetched is treated like a Statsig outage: flags use their
 * defaults and the app starts.
 */
export async function startFeatureFlags({
  statsigSecretId,
  statsigEnvironment,
  secrets,
  logger,
}: FeatureFlagsOptions): Promise<FeatureFlagProvider> {
  if (!statsigSecretId) {
    logger.info('STATSIG_SECRET_ID not set: feature flags use their defaults');
    return staticFeatureFlags();
  }

  let serverSecret: string | undefined;
  try {
    serverSecret = await secrets.get(statsigSecretId);
  } catch (err) {
    logger.warn(
      { err, secretId: statsigSecretId },
      'could not fetch the Statsig key: feature flags use their defaults',
    );
    return staticFeatureFlags();
  }
  if (!serverSecret) {
    logger.warn({ secretId: statsigSecretId }, 'Statsig key secret not found: feature flags use their defaults');
    return staticFeatureFlags();
  }

  return startStatsig({ serverSecret, environment: statsigEnvironment, logger });
}
