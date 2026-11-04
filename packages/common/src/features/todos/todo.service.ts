import { randomUUID } from 'node:crypto';
import type { WriteContext } from '../../db/transaction.ts';
import { NotFoundError } from '../../errors.ts';
import type { Logger } from '../../logger.ts';
import type { TodoRepository } from './todo.repository.ts';
import type { CreateTodoInput, ListTodosQuery, Todo, TodoList, UpdateTodoInput } from './todo.schema.ts';

export interface TodoService {
  /** With `tx`, the todo is written when the caller's transaction commits. */
  create(input: CreateTodoInput, context?: WriteContext): Promise<Todo>;
  get(id: string): Promise<Todo>;
  /** Todos that still exist among `ids`, in the order given. */
  getMany(ids: string[]): Promise<Todo[]>;
  list(query: ListTodosQuery): Promise<TodoList>;
  update(id: string, input: UpdateTodoInput): Promise<Todo>;
  delete(id: string): Promise<void>;
}

export interface TodoServiceDeps {
  logger: Logger;
  todoRepository: TodoRepository;
  now?: () => Date;
}

export function createTodoService({
  logger,
  todoRepository,
  now = () => new Date(),
}: TodoServiceDeps): TodoService {
  const log = logger.child({ component: 'TodoService' });

  return {
    async create(input, { tx } = {}) {
      const timestamp = now().toISOString();
      const todo: Todo = {
        id: randomUUID(),
        title: input.title,
        description: input.description,
        done: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const created = () => log.info({ id: todo.id }, 'todo created');
      if (tx) {
        tx.write(todoRepository.createOp(todo));
        tx.afterCommit(created);
      } else {
        await todoRepository.create(todo);
        created();
      }
      return todo;
    },

    async get(id) {
      const todo = await todoRepository.get(id);
      if (!todo) throw new NotFoundError('Todo', id);
      return todo;
    },

    async getMany(ids) {
      const byId = new Map((await todoRepository.getMany([...new Set(ids)])).map((todo) => [todo.id, todo]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },

    async list(query) {
      return todoRepository.list(query);
    },

    async update(id, input) {
      const todo = await todoRepository.update(id, { ...input, updatedAt: now().toISOString() });
      if (!todo) throw new NotFoundError('Todo', id);
      log.info({ id, done: todo.done }, 'todo updated');
      return todo;
    },

    async delete(id) {
      const deleted = await todoRepository.delete(id);
      if (!deleted) throw new NotFoundError('Todo', id);
      log.info({ id }, 'todo deleted');
    },
  };
}
