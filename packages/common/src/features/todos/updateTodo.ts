import type { Container } from '../../container.ts';
import { afterCommit } from '../../data/unit-of-work.ts';
import { applyTodoUpdate, type Todo, type UpdateTodoInput } from '../../domain/todo.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';
import { getTodo } from './getTodo.ts';

export type UpdateTodoDeps = UseCaseContext & Pick<Container, 'todoRepository'>;

export const updateTodo = useCase(
  'updateTodo',
  async (ctx: UpdateTodoDeps, id: string, input: UpdateTodoInput): Promise<Todo> => {
    const current = await getTodo(ctx, id);
    const todo = applyTodoUpdate(current, input, new Date());
    // Conditional on `updatedAt`, so a concurrent update fails with ConflictError instead of being lost
    ctx.todoRepository.replace(todo, current.updatedAt);
    afterCommit(() => ctx.logger.info({ id, done: todo.done }, 'todo updated'));
    return todo;
  },
);
