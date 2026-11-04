import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../errors.ts';
import type { Logger } from '../../logger.ts';
import type { TodoRepository } from './todo.repository.ts';
import type { CreateTodoInput, ListTodosQuery, Todo, TodoList, UpdateTodoInput } from './todo.schema.ts';

export interface TodoService {
  create(input: CreateTodoInput): Promise<Todo>;
  get(id: string): Promise<Todo>;
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
    async create(input) {
      const timestamp = now().toISOString();
      const todo: Todo = {
        id: randomUUID(),
        title: input.title,
        description: input.description,
        done: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await todoRepository.create(todo);
      log.info({ id: todo.id }, 'todo created');
      return todo;
    },

    async get(id) {
      const todo = await todoRepository.get(id);
      if (!todo) throw new NotFoundError('Todo', id);
      return todo;
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
