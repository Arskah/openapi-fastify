import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Project } from '../domain/project.ts';
import type { Todo } from '../domain/todo.ts';
import { NotFoundError } from '../errors.ts';
import type { RepositoryDeps } from './deps.ts';
import { projectsTable } from './tables/projects.ts';
import { todosTable } from './tables/todos.ts';
import { transactWrite } from './transaction.ts';

/**
 * Persists the project aggregate. Deliberately writes the todos table too:
 * a project and the todos created through it are stored atomically. It uses
 * the todos *table module*, never TodoRepository, so repositories stay
 * independent of each other.
 */
export interface ProjectRepository {
  /** Writes the project and its initial todos in one transaction. */
  create(project: Project, todos?: readonly Todo[]): Promise<void>;
  /** `consistent` reads see writes committed just before, e.g. by a transaction. */
  get(id: string, options?: { consistent?: boolean }): Promise<Project | undefined>;
  /** Writes `todo` and appends it to the project in one transaction. */
  addTodo(projectId: string, todo: Todo, updatedAt: string): Promise<void>;
}

export function createProjectRepository({ config, logger, dynamo }: RepositoryDeps): ProjectRepository {
  const projects = projectsTable(config);
  const todos = todosTable(config);
  const log = logger.child({ component: 'ProjectRepository' });

  return {
    async create(project, initialTodos = []) {
      const ids = initialTodos.map((todo) => todo.id);
      if (ids.length !== project.todoIds.length || ids.some((id, i) => id !== project.todoIds[i])) {
        throw new Error('project.todoIds must match the todos being created');
      }
      log.debug({ id: project.id, todos: ids.length }, 'create project');
      await transactWrite(dynamo, [{ op: projects.put(project) }, ...initialTodos.map((todo) => ({ op: todos.put(todo) }))]);
    },

    async get(id, { consistent = false } = {}) {
      log.debug({ id, consistent }, 'get project');
      const { Item } = await dynamo.send(
        new GetCommand({ TableName: projects.TableName, Key: projects.key(id), ConsistentRead: consistent }),
      );
      return Item && projects.fromItem(Item);
    },

    async addTodo(projectId, todo, updatedAt) {
      log.debug({ id: projectId, todoId: todo.id }, 'add todo to project');
      await transactWrite(dynamo, [
        { op: todos.put(todo) },
        {
          op: projects.appendTodo(projectId, todo.id, updatedAt),
          onConditionFailed: () => new NotFoundError('Project', projectId),
        },
      ]);
    },
  };
}
