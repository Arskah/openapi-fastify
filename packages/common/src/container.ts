import type { CommonConfig } from './config.ts';
import { createDynamoClient, type DynamoClient } from './db/dynamo.ts';
import { todosModule } from './features/todos/index.ts';
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

/** All services for one logger scope. Add new feature modules here. */
function buildScope<C extends CommonConfig>(core: Core<C>) {
  return extend(core, todosModule);
}

export type Scope<C extends CommonConfig = CommonConfig> = ReturnType<typeof buildScope<C>>;

export type Container<C extends CommonConfig = CommonConfig> = Scope<C> & {
  /**
   * Same services bound to another logger (e.g. Fastify's `request.log`),
   * reusing the process-wide singletons such as the DynamoDB client.
   */
  withLogger(logger: Logger): Scope<C>;
  dispose(): void;
};

export interface ContainerOptions<C extends CommonConfig> {
  config: C;
  logger: Logger;
  /** Replace singletons, e.g. a DynamoDB client pointing at a test table. */
  dynamo?: DynamoClient;
}

export function createContainer<C extends CommonConfig>({
  config,
  logger,
  dynamo = createDynamoClient(config),
}: ContainerOptions<C>): Container<C> {
  const scope = (scopeLogger: Logger) => buildScope({ config, logger: scopeLogger, dynamo });

  return {
    ...scope(logger),
    withLogger: scope,
    dispose: () => dynamo.destroy(),
  };
}
