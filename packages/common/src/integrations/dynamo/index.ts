import type { RootTransaction } from '../../repositories/transaction.ts';
import type { RepositoryDeps } from './deps.ts';
import { createProjectRepository } from './project.repository.ts';
import { createTodoRepository } from './todo.repository.ts';
import { DynamoTransaction } from './transaction.ts';

export { DynamoClient } from './client.ts';

/** DynamoDB integration: repositories and transactions, sharing one client. */
export function dynamoModule(deps: RepositoryDeps) {
  const log = deps.logger.child({ component: 'Transaction' });
  return {
    todoRepository: createTodoRepository(deps),
    projectRepository: createProjectRepository(deps),
    beginTransaction: (): RootTransaction => new DynamoTransaction(deps.dynamo, log),
  };
}
