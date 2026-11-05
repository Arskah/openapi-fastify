import type { RootTransaction } from '../../repositories/transaction.ts';
import type { RepositoryDeps } from './deps.ts';
import { createProjectRepository } from './project.repository.ts';
import { createTodoRepository } from './todo.repository.ts';
import { DynamoTransaction } from './transaction.ts';

export { DynamoClient } from './client.ts';
export type { RepositoryDeps } from './deps.ts';
export { tables, type TableDefinition } from './tables/index.ts';
export type { DynamoTransaction } from './transaction.ts';
export type { Write, WriteOp } from './write.ts';
export { createProjectRepository, createTodoRepository };

/** DynamoDB integration: repositories and transactions, sharing one client. */
export function dynamoModule(deps: RepositoryDeps) {
  const log = deps.logger.child({ component: 'Transaction' });
  return {
    todoRepository: createTodoRepository(deps),
    projectRepository: createProjectRepository(deps),
    beginTransaction: (): RootTransaction => new DynamoTransaction(deps.dynamo, log),
  };
}
