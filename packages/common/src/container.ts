import type { CommonConfig } from './config.ts';
import { createContextLogger } from './context.ts';
import { DynamoClient, dynamoModule } from './integrations/dynamo/index.ts';
import type { Logger } from './logger.ts';
import type { FeatureFlagProvider } from './ports/feature-flags.ts';

/** Dependencies every module can rely on. */
export interface Core<C extends CommonConfig = CommonConfig> {
  config: C;
  logger: Logger;
  dynamo: DynamoClient;
  featureFlags: FeatureFlagProvider;
}

/**
 * Adds a module's provisions to the dependencies built so far.
 *
 * The module's parameter type is checked against what has already been
 * provided, so wiring a module before its dependencies is a compile error.
 */
export function extend<D extends object, P extends object>(deps: D, module: (deps: D) => P): D & P {
  return { ...deps, ...module(deps) };
}

/**
 * Process-wide infrastructure: config, logger, DynamoDB client, feature flags,
 * repositories and `beginTransaction`. Use cases are not in here; they are plain functions
 * (see `features/use-case.ts`) that take the container, or the part of it they
 * declare, as their first argument, and open transactions with `useTransaction()`.
 */
export type Container<C extends CommonConfig = CommonConfig> = Core<C> &
  ReturnType<typeof dynamoModule> & { dispose(): void };

export interface ContainerOptions<C extends CommonConfig> {
  config: C;
  /** Root logger, used outside a request context (see `runWithContext`). */
  logger: Logger;
  /**
   * Started by the app beforehand (`startFeatureFlags`, async), and shut down by
   * it too: `dispose()` leaves it running, since the container did not start it.
   */
  featureFlags: FeatureFlagProvider;
  /** Replace singletons, e.g. a DynamoDB client pointing at a test table. */
  dynamo?: DynamoClient;
}

export function createContainer<C extends CommonConfig>({
  config,
  logger,
  featureFlags,
  dynamo = new DynamoClient(config),
}: ContainerOptions<C>): Container<C> {
  // Logs go through the current request's logger when there is one (see context.ts)
  const core: Core<C> = { config, logger: createContextLogger(logger), dynamo, featureFlags };
  return {
    ...extend(core, dynamoModule),
    dispose: () => dynamo.destroy(),
  };
}
