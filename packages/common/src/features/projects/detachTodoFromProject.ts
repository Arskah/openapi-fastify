import type { ProjectRepository } from '../../ports/project.repository.ts';
import { useTransaction, type Transactional, type TransactionDeps } from '../transaction.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';

export type DetachTodoFromProjectDeps = UseCaseContext & TransactionDeps & { projectRepository: ProjectRepository };

/** Removes the todo from the project's list; a no-op if either is already gone. */
export const detachTodoFromProject = useCase(
  'detachTodoFromProject',
  useTransaction(
    async (ctx: Transactional<DetachTodoFromProjectDeps>, projectId: string, todoId: string): Promise<void> => {
      const project = await ctx.projectRepository.get(projectId);
      const index = project?.todoIds.indexOf(todoId) ?? -1;
      if (index < 0) return;
      ctx.projectRepository.removeTodoAt(ctx.tx, projectId, index, todoId, new Date().toISOString());
    },
  ),
);
