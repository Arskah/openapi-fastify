import { createTodo, deleteTodo, getTodo, listTodos, type Todo, unwrap, updateTodo } from '@demo/api-client';
import { buildCommand, buildRouteMap } from '@stricli/core';
import { apiAliases, apiFlags, type ApiFlags, withApi } from '../context.ts';
import { printJson } from '../output.ts';

function parseLimit(value: string): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Must be an integer between 1 and 100.');
  }
  return limit;
}

function printTodos(todos: Todo[]) {
  console.table(todos.map(({ id, title, done, updatedAt }) => ({ id, title, done, updatedAt })));
}

const idParameter = { brief: 'Todo id', parse: String, placeholder: 'id' };

const list = buildCommand({
  docs: { brief: 'List todos' },
  parameters: {
    flags: {
      ...apiFlags,
      limit: { kind: 'parsed', parse: parseLimit, brief: 'Page size (1-100)', placeholder: 'n', default: '20' },
      cursor: { kind: 'parsed', parse: String, brief: 'Cursor from a previous page', optional: true },
      json: { kind: 'boolean', brief: 'Print raw JSON', default: false },
    },
    aliases: { ...apiAliases, l: 'limit', c: 'cursor' },
  },
  func(flags: ApiFlags & { limit: number; cursor?: string; json: boolean }) {
    return withApi(flags, async (api) => {
      const { limit, cursor } = flags;
      const page = await unwrap(api, listTodos({ client: api.client, query: { limit, cursor } }));
      if (flags.json) return printJson(page);
      printTodos(page.items);
      if (page.nextCursor) console.log(`Next page: --cursor ${page.nextCursor}`);
    });
  },
});

const get = buildCommand({
  docs: { brief: 'Show a todo' },
  parameters: {
    positional: { kind: 'tuple', parameters: [idParameter] },
    flags: apiFlags,
    aliases: apiAliases,
  },
  func(flags: ApiFlags, id: string) {
    return withApi(flags, async (api) => {
      printJson(await unwrap(api, getTodo({ client: api.client, path: { id } })));
    });
  },
});

const add = buildCommand({
  docs: { brief: 'Create a todo' },
  parameters: {
    positional: { kind: 'tuple', parameters: [{ brief: 'Todo title', parse: String, placeholder: 'title' }] },
    flags: {
      ...apiFlags,
      description: { kind: 'parsed', parse: String, brief: 'Longer description', placeholder: 'text', optional: true },
    },
    aliases: { ...apiAliases, d: 'description' },
  },
  func(flags: ApiFlags & { description?: string }, title: string) {
    return withApi(flags, async (api) => {
      printJson(await unwrap(api, createTodo({ client: api.client, body: { title, description: flags.description } })));
    });
  },
});

const update = buildCommand({
  docs: { brief: 'Update a todo' },
  parameters: {
    positional: { kind: 'tuple', parameters: [idParameter] },
    flags: {
      ...apiFlags,
      title: { kind: 'parsed', parse: String, brief: 'New title', optional: true },
      description: { kind: 'parsed', parse: String, brief: 'New description', placeholder: 'text', optional: true },
      // Optional boolean: --done / --no-done, omitted leaves it unchanged
      done: { kind: 'boolean', brief: 'Mark as done (--no-done: not done)', optional: true },
    },
    aliases: { ...apiAliases, t: 'title', d: 'description' },
  },
  func(flags: ApiFlags & { title?: string; description?: string; done?: boolean }, id: string) {
    return withApi(flags, async (api) => {
      const { title, description, done } = flags;
      printJson(await unwrap(api, updateTodo({ client: api.client, path: { id }, body: { title, description, done } })));
    });
  },
});

const rm = buildCommand({
  docs: { brief: 'Delete a todo' },
  parameters: {
    positional: { kind: 'tuple', parameters: [idParameter] },
    flags: apiFlags,
    aliases: apiAliases,
  },
  func(flags: ApiFlags, id: string) {
    return withApi(flags, async (api) => {
      await unwrap(api, deleteTodo({ client: api.client, path: { id } }));
      console.log(`Deleted ${id}`);
    });
  },
});

export const todosRoutes = buildRouteMap({
  routes: { list, get, add, update, rm },
  docs: { brief: 'Manage todos' },
});
