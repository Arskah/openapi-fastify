import type { TodoRepository } from '../../data/todo.repository.ts';
import type { Logger } from '../../logger.ts';
import { createTodoService } from './todo.service.ts';

export * from './todo.schema.ts';
export type { TodoService } from './todo.service.ts';
export { createTodoService };

export function todosModule(deps: { logger: Logger; todoRepository: TodoRepository }) {
  return { todoService: createTodoService(deps) };
}
