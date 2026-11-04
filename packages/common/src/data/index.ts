import type { RepositoryDeps } from './deps.ts';
import { createProjectRepository } from './project.repository.ts';
import { createTodoRepository } from './todo.repository.ts';
import { createUnitOfWorkRunner } from './unit-of-work.ts';

export type { RepositoryDeps } from './deps.ts';
export { createDynamoClient, type DynamoClient } from './dynamo.ts';
export type { ProjectRepository } from './project.repository.ts';
export { tables, type TableDefinition } from './tables/index.ts';
export type { TodoRepository } from './todo.repository.ts';
export type { Write, WriteOp } from './transaction.ts';
export { afterCommit, type UnitOfWorkRunner } from './unit-of-work.ts';
export { createProjectRepository, createTodoRepository };

/** Data layer module: repositories and the unit of work, sharing one DynamoDB client. */
export function dataModule(deps: RepositoryDeps) {
  return {
    todoRepository: createTodoRepository(deps),
    projectRepository: createProjectRepository(deps),
    unitOfWork: createUnitOfWorkRunner(deps),
  };
}
