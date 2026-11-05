import type { Container } from '../../container.ts';
import { withTodos } from '../../domain/project.ts';
import type { CreateTodoInput } from '../../domain/todo.ts';
import { NotFoundError } from '../../errors.ts';
import { createTodo, type CreateTodoDeps } from '../todos/createTodo.ts';
import { useTransaction, type Transactional } from '../transaction.ts';
import { useCase } from '../use-case.ts';
import type { ProjectTodo } from './project.schema.ts';

export type AddTodoToProjectDeps = CreateTodoDeps & Pick<Container, 'projectRepository'>;

/** Creates a todo (via `createTodo`) and appends it to the project in one transaction. */
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

      const todo = await createTodo(ctx, input, { projectId });
      const now = new Date();
      ctx.projectRepository.appendTodos(ctx.tx, projectId, [todo.id], now.toISOString());
      ctx.tx.afterCommit(() => ctx.logger.info({ id: projectId, todoId: todo.id }, 'todo added to project'));

      // Appends by concurrent requests are not reflected here; getProject has the full list
      return { project: withTodos(project, [todo.id], now), todo };
    },
  ),
);
