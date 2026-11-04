import type { ProjectRepository } from '../../data/project.repository.ts';
import type { TodoRepository } from '../../data/todo.repository.ts';
import type { Logger } from '../../logger.ts';
import { createProjectService } from './project.service.ts';

export * from './project.schema.ts';
export type { ProjectService } from './project.service.ts';
export { createProjectService };

export function projectsModule(deps: {
  logger: Logger;
  projectRepository: ProjectRepository;
  todoRepository: TodoRepository;
}) {
  return { projectService: createProjectService(deps) };
}
