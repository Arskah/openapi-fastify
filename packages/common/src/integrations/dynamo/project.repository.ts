import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Project } from '../../domain/project.ts';
import { ConflictError, NotFoundError } from '../../errors.ts';
import type { ProjectRepository } from '../../repositories/project.repository.ts';
import type { RepositoryDeps } from './deps.ts';
import { projectsTable } from './tables/projects.ts';
import { DynamoTransaction } from './transaction.ts';

export function createProjectRepository({ config, logger, dynamo }: RepositoryDeps): ProjectRepository {
  const table = projectsTable(config);
  const log = logger.child({ component: 'ProjectRepository' });

  return {
    async get(id, { consistent = false } = {}) {
      log.debug({ id, consistent }, 'get project');
      const { Item } = await dynamo.send(
        new GetCommand({ TableName: table.TableName, Key: table.key(id), ConsistentRead: consistent }),
      );
      return Item && table.fromItem(Item);
    },

    create(tx, project) {
      log.debug({ id: project.id }, 'stage insert project');
      DynamoTransaction.of(tx).stage({
        op: table.insert(project),
        item: table.item(project.id),
        onConditionFailed: () => new ConflictError(`Project '${project.id}' already exists`),
      });
    },

    appendTodos(tx, id, todoIds, updatedAt) {
      log.debug({ id, todoIds }, 'stage append todos to project');
      DynamoTransaction.of(tx).stage({
        op: table.appendTodos(id, todoIds, updatedAt),
        item: table.item(id),
        onConditionFailed: () => new NotFoundError('Project', id),
      });
    },

    removeTodoAt(tx, id, index, todoId, updatedAt) {
      log.debug({ id, index, todoId }, 'stage remove todo from project');
      DynamoTransaction.of(tx).stage({
        op: table.removeTodoAt(id, index, todoId, updatedAt),
        item: table.item(id),
        onConditionFailed: () => new ConflictError(`Project '${id}' changed concurrently; retry`),
      });
    },
  };
}
