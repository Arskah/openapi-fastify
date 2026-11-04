import type { Container } from '../../container.ts';
import { NotFoundError } from '../../errors.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';
import { toProjectDetails, type ProjectDetails } from './project.schema.ts';

export type GetProjectDeps = UseCaseContext & Pick<Container, 'projectRepository' | 'todoRepository'>;

export const getProject = useCase('getProject', async (ctx: GetProjectDeps, id: string): Promise<ProjectDetails> => {
  const project = await ctx.projectRepository.get(id);
  if (!project) throw new NotFoundError('Project', id);
  return toProjectDetails(project, await ctx.todoRepository.getMany(project.todoIds));
});
