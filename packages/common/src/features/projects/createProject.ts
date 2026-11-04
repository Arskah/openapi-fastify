import type { Container } from '../../container.ts';
import { afterCommit } from '../../data/unit-of-work.ts';
import { newProject, withTodos } from '../../domain/project.ts';
import { createTodo, type CreateTodoDeps } from '../todos/createTodo.ts';
import { useCase } from '../use-case.ts';
import { toProjectDetails, type CreateProjectInput, type ProjectDetails } from './project.schema.ts';

export type CreateProjectDeps = CreateTodoDeps & Pick<Container, 'projectRepository'>;

/** Creates the project and its initial todos (via `createTodo`) in one transaction. */
export const createProject = useCase(
  'createProject',
  async (ctx: CreateProjectDeps, input: CreateProjectInput): Promise<ProjectDetails> => {
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
    ctx.projectRepository.create(created);
    afterCommit(() => ctx.logger.info({ id: created.id, todos: todos.length }, 'project created'));
    return toProjectDetails(created, todos);
  },
);
