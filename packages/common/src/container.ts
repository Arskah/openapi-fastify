import type { CommonConfig } from './config.ts';
import { createContextLogger } from './context.ts';
import { createDynamoClient, type DynamoClient, repositoriesModule } from './data/index.ts';
import { projectsModule } from './features/projects/index.ts';
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

/**
 * Layers are composed bottom-up: core → repositories → features. Features
 * depend on repositories (and domain), never on each other.
 */
function buildServices<C extends CommonConfig>(core: Core<C>) {
  const data = extend(core, repositoriesModule);
  return extend(extend(data, todosModule), projectsModule);
}

export type Container<C extends CommonConfig = CommonConfig> = ReturnType<typeof buildServices<C>> & {
  dispose(): void;
};

export interface ContainerOptions<C extends CommonConfig> {
  config: C;
  /** Root logger, used outside a request context (see `runWithContext`). */
  logger: Logger;
  /** Replace singletons, e.g. a DynamoDB client pointing at a test table. */
  dynamo?: DynamoClient;
}

/**
 * Builds every service once for the process. Services log through a context
 * logger, so calls made inside `runWithContext({ logger })` log with that
 * logger (e.g. carrying the request ID) without rebuilding anything.
 */
export function createContainer<C extends CommonConfig>({
  config,
  logger,
  dynamo = createDynamoClient(config),
}: ContainerOptions<C>): Container<C> {
  return {
    ...buildServices({ config, logger: createContextLogger(logger), dynamo }),
    dispose: () => dynamo.destroy(),
  };
}
