import type { ProjectRepository } from '../../data/project.repository.ts';
import type { TodoRepository } from '../../data/todo.repository.ts';
import { createProject, type Project } from '../../domain/project.ts';
import { createTodo, type CreateTodoInput, type Todo } from '../../domain/todo.ts';
import { NotFoundError } from '../../errors.ts';
import type { Logger } from '../../logger.ts';
import type { CreateProjectInput, ProjectDetails, ProjectTodo } from './project.schema.ts';

export interface ProjectService {
  /** Creates the project and its initial todos atomically. */
  create(input: CreateProjectInput): Promise<ProjectDetails>;
  get(id: string): Promise<ProjectDetails>;
  /** Creates a todo and attaches it to the project atomically. */
  addTodo(projectId: string, input: CreateTodoInput): Promise<ProjectTodo>;
}

/** Mixes domain objects: uses both repositories, never another feature. */
export interface ProjectServiceDeps {
  logger: Logger;
  projectRepository: ProjectRepository;
  todoRepository: TodoRepository;
  now?: () => Date;
}

export function createProjectService({
  logger,
  projectRepository,
  todoRepository,
  now = () => new Date(),
}: ProjectServiceDeps): ProjectService {
  const log = logger.child({ component: 'ProjectService' });

  async function getProject(id: string, options?: { consistent?: boolean }): Promise<Project> {
    const project = await projectRepository.get(id, options);
    if (!project) throw new NotFoundError('Project', id);
    return project;
  }

  function details({ todoIds: _, ...project }: Project, todos: Todo[]): ProjectDetails {
    return { ...project, todos };
  }

  return {
    async create(input) {
      const at = now();
      const todos = (input.todos ?? []).map((todo) => createTodo(todo, at));
      const project = createProject(input, todos, at);
      await projectRepository.create(project, todos);
      log.info({ id: project.id, todos: todos.length }, 'project created');
      return details(project, todos);
    },

    async get(id) {
      const project = await getProject(id);
      return details(project, await todoRepository.getMany(project.todoIds));
    },

    async addTodo(projectId, input) {
      const at = now();
      const todo = createTodo(input, at);
      await projectRepository.addTodo(projectId, todo, at.toISOString());

      // TransactWriteItems returns no attributes, so read the committed project back
      const project = await getProject(projectId, { consistent: true });
      log.info({ id: projectId, todoId: todo.id }, 'todo added to project');
      return { project, todo };
    },
  };
}
