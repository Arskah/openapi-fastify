import { Command } from '@commander-js/extra-typings';
import { unwrap, type Api } from '../api.ts';
import { addProjectTodo, createProject, getProject } from '../client/sdk.gen.ts';
import { printJson } from '../output.ts';

export function projectsCommand(getApi: () => Api) {
  const projects = new Command('projects').description('Manage projects');

  projects
    .command('create')
    .description('Create a project, optionally with initial todos (created atomically)')
    .argument('<name>', 'project name')
    .option('-t, --todo <title...>', 'initial todo titles')
    .action(async (name, { todo = [] }) => {
      const api = getApi();
      const todos = todo.map((title) => ({ title }));
      printJson(await unwrap(api, createProject({ client: api.client, body: { name, todos } })));
    });

  projects
    .command('get')
    .description('Show a project with its todos')
    .argument('<id>', 'project id')
    .option('--json', 'print raw JSON')
    .action(async (id, { json }) => {
      const api = getApi();
      const project = await unwrap(api, getProject({ client: api.client, path: { id } }));
      if (json) return printJson(project);
      console.log(`${project.name} (${project.id})`);
      console.table(project.todos.map(({ id, title, done }) => ({ id, title, done })));
    });

  projects
    .command('add-todo')
    .description('Create a todo in a project')
    .argument('<id>', 'project id')
    .argument('<title>', 'todo title')
    .option('-d, --description <text>', 'longer description')
    .action(async (id, title, { description }) => {
      const api = getApi();
      const { todo } = await unwrap(
        api,
        addProjectTodo({ client: api.client, path: { id }, body: { title, description } }),
      );
      printJson(todo);
    });

  return projects;
}
