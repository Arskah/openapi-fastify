// Public API of the projects feature, for apps. Use cases in other features import the files directly,
// never this barrel. `detachTodoFromProject` is internal: only `deleteTodo` composes it.
export { addTodoToProject } from './addTodoToProject.ts';
export { createProject } from './createProject.ts';
export { getProject } from './getProject.ts';
export {
  CreateProjectInputSchema,
  ProjectDetailsSchema,
  ProjectTodoSchema,
  type CreateProjectInput,
  type ProjectDetails,
  type ProjectTodo,
} from './project.schema.ts';
