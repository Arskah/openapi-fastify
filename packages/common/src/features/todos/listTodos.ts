import type { TodoRepository } from '../../repositories/todo.repository.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';
import type { ListTodosQuery, TodoList } from './todo.schema.ts';

export type ListTodosDeps = UseCaseContext & { todoRepository: TodoRepository };

export const listTodos = useCase('listTodos', async (ctx: ListTodosDeps, query: ListTodosQuery): Promise<TodoList> =>
  ctx.todoRepository.list(query),
);
