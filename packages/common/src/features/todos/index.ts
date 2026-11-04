import type { CommonConfig } from '../../config.ts';
import type { DynamoClient } from '../../db/dynamo.ts';
import type { Logger } from '../../logger.ts';
import { createTodoRepository } from './todo.repository.ts';
import { createTodoService } from './todo.service.ts';

export * from './todo.schema.ts';
export { todosTable } from './todo.table.ts';
export type { TodoRepository } from './todo.repository.ts';
export type { TodoService } from './todo.service.ts';
export { createTodoRepository, createTodoService };

/** Feature module: declares what it needs (deps) and what it provides. */
export function todosModule(deps: { config: CommonConfig; logger: Logger; dynamo: DynamoClient }) {
  const todoRepository = createTodoRepository(deps);
  const todoService = createTodoService({ ...deps, todoRepository });
  return { todoRepository, todoService };
}
