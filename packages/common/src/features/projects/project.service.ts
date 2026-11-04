import { randomUUID } from 'node:crypto';
import type { RunTransaction } from '../../db/transaction.ts';
import { NotFoundError } from '../../errors.ts';
import type { Logger } from '../../logger.ts';
import type { CreateTodoInput } from '../todos/todo.schema.ts';
import type { TodoService } from '../todos/todo.service.ts';
import type { ProjectRepository } from './project.repository.ts';
import type { CreateProjectInput, Project, ProjectDetails, ProjectTodo } from './project.schema.ts';

export interface ProjectService {
  create(input: CreateProjectInput): Promise<Project>;
  /** Project with its todos resolved; todos deleted since are left out. */
  get(id: string): Promise<ProjectDetails>;
  /** Creates a todo and attaches it to the project atomically. */
  addTodo(projectId: string, input: CreateTodoInput): Promise<ProjectTodo>;
}

export interface ProjectServiceDeps {
  logger: Logger;
  projectRepository: ProjectRepository;
  /** Another feature's service: projects go through todos' public API, not its repository. */
  todoService: TodoService;
  transact: RunTransaction;
  now?: () => Date;
}

export function createProjectService({
  logger,
  projectRepository,
  todoService,
  transact,
  now = () => new Date(),
}: ProjectServiceDeps): ProjectService {
  const log = logger.child({ component: 'ProjectService' });

  async function getProject(id: string, options?: { consistent?: boolean }): Promise<Project> {
    const project = await projectRepository.get(id, options);
    if (!project) throw new NotFoundError('Project', id);
    return project;
  }

  return {
    async create(input) {
      const timestamp = now().toISOString();
      const project: Project = {
        id: randomUUID(),
        name: input.name,
        todoIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await projectRepository.create(project);
      log.info({ id: project.id }, 'project created');
      return project;
    },

    async get(id) {
      const { todoIds, ...project } = await getProject(id);
      return { ...project, todos: await todoService.getMany(todoIds) };
    },

    async addTodo(projectId, input) {
      const todo = await transact(async (tx) => {
        // todoService keeps its rules (id, defaults, timestamps); only the write joins our transaction
        const todo = await todoService.create(input, { tx });
        tx.write(projectRepository.appendTodoOp(projectId, todo.id, now().toISOString()), {
          onConditionFailed: () => new NotFoundError('Project', projectId),
        });
        return todo;
      });

      // TransactWriteItems returns no attributes, so read the committed project back
      const project = await getProject(projectId, { consistent: true });
      log.info({ id: projectId, todoId: todo.id }, 'todo added to project');
      return { project, todo };
    },
  };
}
