import { withTodos } from '../../domain/project.ts';
import type { CreateTodoInput } from '../../domain/todo.ts';
import { ConflictError, NotFoundError } from '../../errors.ts';
import type { FeatureFlags } from '../../ports/feature-flags.ts';
import type { ProjectRepository } from '../../ports/project.repository.ts';
import { createTodo, type CreateTodoDeps } from '../todos/createTodo.ts';
import { useTransaction, type Transactional } from '../transaction.ts';
import { useCase } from '../use-case.ts';
import type { ProjectTodo } from './project.schema.ts';

export type AddTodoToProjectDeps = CreateTodoDeps & {
  projectRepository: ProjectRepository;
  featureFlags: FeatureFlags;
};

/**
 * Creates a todo (via `createTodo`) and appends it to the project in one transaction.
 *
 * Behind the `enforce_project_todo_limit` gate, a project holds at most
 * `maxTodosPerProject` todos. The count comes from an eventually consistent
 * read, so concurrent adds can overshoot it: a product limit, not an invariant.
 */
export const addTodoToProject = useCase(
  'addTodoToProject',
  useTransaction(
    async (
      ctx: Transactional<AddTodoToProjectDeps>,
      projectId: string,
      input: CreateTodoInput,
    ): Promise<ProjectTodo> => {
      // Read for a fast 404 and for the response; the staged append re-checks existence on commit
      const project = await ctx.projectRepository.get(projectId);
      if (!project) throw new NotFoundError('Project', projectId);

      if (ctx.featureFlags.isEnabled('enforce_project_todo_limit')) {
        const max = ctx.featureFlags.value('maxTodosPerProject');
        if (project.todoIds.length >= max) throw new ConflictError(`Project '${projectId}' already has ${max} todos`);
      }

      const todo = await createTodo(ctx, input, { projectId });
      const now = new Date();
      ctx.projectRepository.appendTodos(ctx.tx, projectId, [todo.id], now.toISOString());
      ctx.tx.afterCommit(() => ctx.logger.info({ id: projectId, todoId: todo.id }, 'todo added to project'));

      // Appends by concurrent requests are not reflected here; getProject has the full list
      return { project: withTodos(project, [todo.id], now), todo };
    },
  ),
);
