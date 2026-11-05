import type { TodoRepository } from '../../ports/todo.repository.ts';
import { detachTodoFromProject, type DetachTodoFromProjectDeps } from '../projects/detachTodoFromProject.ts';
import { useTransaction, type Transactional } from '../transaction.ts';
import { useCase } from '../use-case.ts';
import { getTodo } from './getTodo.ts';

export type DeleteTodoDeps = DetachTodoFromProjectDeps & { todoRepository: TodoRepository };

/** Deletes the todo and removes it from its project in one transaction. */
export const deleteTodo = useCase(
  'deleteTodo',
  useTransaction(async (ctx: Transactional<DeleteTodoDeps>, id: string): Promise<void> => {
    const todo = await getTodo(ctx, id);
    ctx.todoRepository.delete(ctx.tx, id);
    if (todo.projectId) await detachTodoFromProject(ctx, todo.projectId, id);
    ctx.tx.afterCommit(() => ctx.logger.info({ id, projectId: todo.projectId }, 'todo deleted'));
  }),
);
