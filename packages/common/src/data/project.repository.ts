import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Project } from '../domain/project.ts';
import { ConflictError, NotFoundError } from '../errors.ts';
import type { RepositoryDeps } from './deps.ts';
import { projectsTable } from './tables/projects.ts';
import type { Transaction } from './transaction.ts';

/** Reads run immediately; writes are staged in the given transaction. */
export interface ProjectRepository {
  /** `consistent` reads see writes committed just before. */
  get(id: string, options?: { consistent?: boolean }): Promise<Project | undefined>;
  create(tx: Transaction, project: Project): void;
  /** Atomic append; NotFoundError on commit if the project does not exist. */
  appendTodos(tx: Transaction, id: string, todoIds: readonly string[], updatedAt: string): void;
  /** Removes `todoId` found at `index`; ConflictError on commit if the list changed meanwhile. */
  removeTodoAt(tx: Transaction, id: string, index: number, todoId: string, updatedAt: string): void;
}

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
      tx.stage({
        op: table.insert(project),
        item: table.item(project.id),
        onConditionFailed: () => new ConflictError(`Project '${project.id}' already exists`),
      });
    },

    appendTodos(tx, id, todoIds, updatedAt) {
      log.debug({ id, todoIds }, 'stage append todos to project');
      tx.stage({
        op: table.appendTodos(id, todoIds, updatedAt),
        item: table.item(id),
        onConditionFailed: () => new NotFoundError('Project', id),
      });
    },

    removeTodoAt(tx, id, index, todoId, updatedAt) {
      log.debug({ id, index, todoId }, 'stage remove todo from project');
      tx.stage({
        op: table.removeTodoAt(id, index, todoId, updatedAt),
        item: table.item(id),
        onConditionFailed: () => new ConflictError(`Project '${id}' changed concurrently; retry`),
      });
    },
  };
}
