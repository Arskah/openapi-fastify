import { NotFoundError } from '../../errors.ts';
import type { ProjectRepository } from '../../ports/project.repository.ts';
import type { TodoRepository } from '../../ports/todo.repository.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';
import { toProjectDetails, type ProjectDetails } from './project.schema.ts';

export type GetProjectDeps = UseCaseContext & { projectRepository: ProjectRepository; todoRepository: TodoRepository };

export const getProject = useCase('getProject', async (ctx: GetProjectDeps, id: string): Promise<ProjectDetails> => {
  const project = await ctx.projectRepository.get(id);
  if (!project) throw new NotFoundError('Project', id);
  return toProjectDetails(project, await ctx.todoRepository.getMany(project.todoIds));
});
