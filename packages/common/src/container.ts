import type { CommonConfig } from './config.ts';
import { createContextLogger } from './context.ts';
import { createDynamoClient, dataModule, type DynamoClient } from './data/index.ts';
import type { Logger } from './logger.ts';

/** Dependencies every module can rely on. */
export interface Core<C extends CommonConfig = CommonConfig> {
  config: C;
  logger: Logger;
  dynamo: DynamoClient;
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
 * Process-wide infrastructure: config, logger, DynamoDB client, repositories
 * and the unit-of-work factory. Transactions are not in here: use cases open
 * them with `transaction()`. Use cases are not in here either; they are plain functions
 * (see `features/use-case.ts`) that take the container, or the part of it they
 * declare, as their first argument.
 */
export type Container<C extends CommonConfig = CommonConfig> = Core<C> &
  ReturnType<typeof dataModule> & { dispose(): void };

export interface ContainerOptions<C extends CommonConfig> {
  config: C;
  /** Root logger, used outside a request context (see `runWithContext`). */
  logger: Logger;
  /** Replace singletons, e.g. a DynamoDB client pointing at a test table. */
  dynamo?: DynamoClient;
}

export function createContainer<C extends CommonConfig>({
  config,
  logger,
  dynamo = createDynamoClient(config),
}: ContainerOptions<C>): Container<C> {
  // Logs go through the current request's logger when there is one (see context.ts)
  const core: Core<C> = { config, logger: createContextLogger(logger), dynamo };
  return {
    ...extend(core, dataModule),
    dispose: () => dynamo.destroy(),
  };
}
