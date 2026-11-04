import type { Container } from '../../container.ts';
import { afterCommit } from '../../data/unit-of-work.ts';
import { newTodo, type CreateTodoInput, type Todo } from '../../domain/todo.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';

export type CreateTodoDeps = UseCaseContext & Pick<Container, 'todoRepository'>;

/** With `projectId`, the caller is responsible for adding the todo to that project. */
export const createTodo = useCase(
  'createTodo',
  async (ctx: CreateTodoDeps, input: CreateTodoInput, options: { projectId?: string } = {}): Promise<Todo> => {
    const todo = newTodo(input, new Date(), options);
    ctx.todoRepository.create(todo);
    afterCommit(() => ctx.logger.info({ id: todo.id }, 'todo created'));
    return todo;
  },
);
