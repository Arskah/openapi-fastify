import { addProjectTodo, createProject, getProject, unwrap } from '@demo/api-client';
import { buildCommand, buildRouteMap } from '@stricli/core';
import { apiAliases, apiFlags, type ApiFlags, withApi } from '../context.ts';
import { printJson } from '../output.ts';

const create = buildCommand({
  docs: { brief: 'Create a project, optionally with initial todos (created atomically)' },
  parameters: {
    positional: { kind: 'tuple', parameters: [{ brief: 'Project name', parse: String, placeholder: 'name' }] },
    flags: {
      ...apiFlags,
      todo: { kind: 'parsed', parse: String, brief: 'Initial todo title (repeatable)', placeholder: 'title', variadic: true, optional: true },
    },
    aliases: { ...apiAliases, t: 'todo' },
  },
  func(flags: ApiFlags & { todo?: string[] }, name: string) {
    return withApi(flags, async (api) => {
      const todos = (flags.todo ?? []).map((title) => ({ title }));
      printJson(await unwrap(api, createProject({ client: api.client, body: { name, todos } })));
    });
  },
});

const get = buildCommand({
  docs: { brief: 'Show a project with its todos' },
  parameters: {
    positional: { kind: 'tuple', parameters: [{ brief: 'Project id', parse: String, placeholder: 'id' }] },
    flags: { ...apiFlags, json: { kind: 'boolean', brief: 'Print raw JSON', default: false } },
    aliases: apiAliases,
  },
  func(flags: ApiFlags & { json: boolean }, id: string) {
    return withApi(flags, async (api) => {
      const project = await unwrap(api, getProject({ client: api.client, path: { id } }));
      if (flags.json) return printJson(project);
      console.log(`${project.name} (${project.id})`);
      console.table(project.todos.map(({ id, title, done }) => ({ id, title, done })));
    });
  },
});

const addTodo = buildCommand({
  docs: { brief: 'Create a todo in a project' },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        { brief: 'Project id', parse: String, placeholder: 'id' },
        { brief: 'Todo title', parse: String, placeholder: 'title' },
      ],
    },
    flags: {
      ...apiFlags,
      description: { kind: 'parsed', parse: String, brief: 'Longer description', placeholder: 'text', optional: true },
    },
    aliases: { ...apiAliases, d: 'description' },
  },
  func(flags: ApiFlags & { description?: string }, id: string, title: string) {
    return withApi(flags, async (api) => {
      const { todo } = await unwrap(
        api,
        addProjectTodo({ client: api.client, path: { id }, body: { title, description: flags.description } }),
      );
      printJson(todo);
    });
  },
});

export const projectsRoutes = buildRouteMap({
  routes: { create, get, 'add-todo': addTodo },
  docs: { brief: 'Manage projects' },
});
