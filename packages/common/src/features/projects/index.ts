import type { CommonConfig } from '../../config.ts';
import type { DynamoClient } from '../../db/dynamo.ts';
import type { RunTransaction } from '../../db/transaction.ts';
import type { Logger } from '../../logger.ts';
import type { TodoService } from '../todos/todo.service.ts';
import { createProjectRepository } from './project.repository.ts';
import { createProjectService } from './project.service.ts';

export * from './project.schema.ts';
export { projectsTable } from './project.table.ts';
export type { ProjectRepository } from './project.repository.ts';
export type { ProjectService } from './project.service.ts';
export { createProjectRepository, createProjectService };

/** Feature module: needs the todos module's `todoService`, so it must be composed after it. */
export function projectsModule(deps: {
  config: CommonConfig;
  logger: Logger;
  dynamo: DynamoClient;
  transact: RunTransaction;
  todoService: TodoService;
}) {
  const projectRepository = createProjectRepository(deps);
  const projectService = createProjectService({ ...deps, projectRepository });
  return { projectRepository, projectService };
}
