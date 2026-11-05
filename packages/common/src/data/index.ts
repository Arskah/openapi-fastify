import type { RepositoryDeps } from './deps.ts';
import { createProjectRepository } from './project.repository.ts';
import { createTodoRepository } from './todo.repository.ts';
import { DynamoTransaction } from './transaction.ts';

export type { RepositoryDeps } from './deps.ts';
export { DynamoClient } from './dynamo.ts';
export type { ProjectRepository } from './project.repository.ts';
export { tables, type TableDefinition } from './tables/index.ts';
export type { TodoRepository } from './todo.repository.ts';
export type { DynamoTransaction, Transaction } from './transaction.ts';
export type { Write, WriteOp } from './write.ts';
export { createProjectRepository, createTodoRepository };

/** Data layer module: repositories and transactions, sharing one DynamoDB client. */
export function dataModule(deps: RepositoryDeps) {
  const log = deps.logger.child({ component: 'Transaction' });
  return {
    todoRepository: createTodoRepository(deps),
    projectRepository: createProjectRepository(deps),
    beginTransaction: () => new DynamoTransaction(deps.dynamo, log),
  };
}
