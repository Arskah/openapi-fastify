import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Project } from '../domain/project.ts';
import { ConflictError, NotFoundError } from '../errors.ts';
import type { RepositoryDeps } from './deps.ts';
import { projectsTable } from './tables/projects.ts';
import { stageWrite } from './unit-of-work.ts';

/** Reads run immediately; writes are staged in the current unit of work. */
export interface ProjectRepository {
  /** `consistent` reads see writes committed just before. */
  get(id: string, options?: { consistent?: boolean }): Promise<Project | undefined>;
  create(project: Project): void;
  /** Atomic append; NotFoundError on commit if the project does not exist. */
  appendTodos(id: string, todoIds: readonly string[], updatedAt: string): void;
  /** Removes `todoId` found at `index`; ConflictError on commit if the list changed meanwhile. */
  removeTodoAt(id: string, index: number, todoId: string, updatedAt: string): void;
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

    create(project) {
      log.debug({ id: project.id }, 'stage insert project');
      stageWrite({
        op: table.insert(project),
        item: table.item(project.id),
        onConditionFailed: () => new ConflictError(`Project '${project.id}' already exists`),
      });
    },

    appendTodos(id, todoIds, updatedAt) {
      log.debug({ id, todoIds }, 'stage append todos to project');
      stageWrite({
        op: table.appendTodos(id, todoIds, updatedAt),
        item: table.item(id),
        onConditionFailed: () => new NotFoundError('Project', id),
      });
    },

    removeTodoAt(id, index, todoId, updatedAt) {
      log.debug({ id, index, todoId }, 'stage remove todo from project');
      stageWrite({
        op: table.removeTodoAt(id, index, todoId, updatedAt),
        item: table.item(id),
        onConditionFailed: () => new ConflictError(`Project '${id}' changed concurrently; retry`),
      });
    },
  };
}
