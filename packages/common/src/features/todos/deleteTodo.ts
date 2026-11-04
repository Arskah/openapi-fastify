import type { Container } from '../../container.ts';
import { afterCommit } from '../../data/unit-of-work.ts';
import {
  detachTodoFromProject,
  type DetachTodoFromProjectDeps,
} from '../projects/detachTodoFromProject.ts';
import { useCase } from '../use-case.ts';
import { getTodo } from './getTodo.ts';

export type DeleteTodoDeps = DetachTodoFromProjectDeps & Pick<Container, 'todoRepository'>;

/** Deletes the todo and removes it from its project in one transaction. */
export const deleteTodo = useCase('deleteTodo', async (ctx: DeleteTodoDeps, id: string): Promise<void> => {
  const todo = await getTodo(ctx, id);
  ctx.todoRepository.delete(id);
  if (todo.projectId) await detachTodoFromProject(ctx, todo.projectId, id);
  afterCommit(() => ctx.logger.info({ id, projectId: todo.projectId }, 'todo deleted'));
});
