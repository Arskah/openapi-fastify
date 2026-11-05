import { newProject, withTodos } from '../../domain/project.ts';
import type { ProjectRepository } from '../../ports/project.repository.ts';
import { createTodo, type CreateTodoDeps } from '../todos/createTodo.ts';
import { useTransaction, type Transactional } from '../transaction.ts';
import { useCase } from '../use-case.ts';
import { toProjectDetails, type CreateProjectInput, type ProjectDetails } from './project.schema.ts';

export type CreateProjectDeps = CreateTodoDeps & { projectRepository: ProjectRepository };

/** Creates the project and its initial todos (via `createTodo`) in one transaction. */
export const createProject = useCase(
  'createProject',
  useTransaction(async (ctx: Transactional<CreateProjectDeps>, input: CreateProjectInput): Promise<ProjectDetails> => {
    const now = new Date();
    const project = newProject(input, now);
    const todos = await Promise.all(
      (input.todos ?? []).map((todo) => createTodo(ctx, todo, { projectId: project.id })),
    );
    const created = withTodos(
      project,
      todos.map((todo) => todo.id),
      now,
    );
    ctx.projectRepository.create(ctx.tx, created);
    ctx.tx.afterCommit(() => ctx.logger.info({ id: created.id, todos: todos.length }, 'project created'));
    return toProjectDetails(created, todos);
  }),
);
