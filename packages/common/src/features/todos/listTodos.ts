import type { Container } from '../../container.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';
import type { ListTodosQuery, TodoList } from './todo.schema.ts';

export type ListTodosDeps = UseCaseContext & Pick<Container, 'todoRepository'>;

export const listTodos = useCase(
  'listTodos',
  async (ctx: ListTodosDeps, query: ListTodosQuery): Promise<TodoList> => ctx.todoRepository.list(query),
);
