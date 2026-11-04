import type { RepositoryDeps } from './deps.ts';
import { createProjectRepository } from './project.repository.ts';
import { createTodoRepository } from './todo.repository.ts';

export { createDynamoClient, type DynamoClient } from './dynamo.ts';
export type { ProjectRepository } from './project.repository.ts';
export { tables, type TableDefinition } from './tables/index.ts';
export type { RepositoryDeps } from './deps.ts';
export type { TodoRepository } from './todo.repository.ts';
export type { TransactionWrite, WriteOp } from './transaction.ts';
export { createProjectRepository, createTodoRepository };

/** Data layer module: every repository, sharing one DynamoDB client. */
export function repositoriesModule(deps: RepositoryDeps) {
  return {
    todoRepository: createTodoRepository(deps),
    projectRepository: createProjectRepository(deps),
  };
}
