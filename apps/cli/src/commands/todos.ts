import { Command, InvalidArgumentError } from '@commander-js/extra-typings';
import { unwrap, type Api } from '../api.ts';
import { createTodo, deleteTodo, getTodo, listTodos, updateTodo } from '../client/sdk.gen.ts';
import type { Todo } from '../client/types.gen.ts';
import { printJson } from '../output.ts';

function parseLimit(value: string): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new InvalidArgumentError('Must be an integer between 1 and 100.');
  }
  return limit;
}

function printTodos(todos: Todo[]) {
  console.table(todos.map(({ id, title, done, updatedAt }) => ({ id, title, done, updatedAt })));
}

export function todosCommand(getApi: () => Api) {
  const todos = new Command('todos').description('Manage todos');

  todos
    .command('list')
    .description('List todos')
    .option('-l, --limit <n>', 'page size (1-100)', parseLimit, 20)
    .option('-c, --cursor <cursor>', 'cursor from a previous page')
    .option('--json', 'print raw JSON')
    .action(async ({ limit, cursor, json }) => {
      const api = getApi();
      const page = await unwrap(api, listTodos({ client: api.client, query: { limit, cursor } }));
      if (json) return printJson(page);
      printTodos(page.items);
      if (page.nextCursor) console.log(`Next page: --cursor ${page.nextCursor}`);
    });

  todos
    .command('get')
    .description('Show a todo')
    .argument('<id>', 'todo id')
    .action(async (id) => {
      const api = getApi();
      printJson(await unwrap(api, getTodo({ client: api.client, path: { id } })));
    });

  todos
    .command('add')
    .description('Create a todo')
    .argument('<title>', 'todo title')
    .option('-d, --description <text>', 'longer description')
    .action(async (title, { description }) => {
      const api = getApi();
      printJson(await unwrap(api, createTodo({ client: api.client, body: { title, description } })));
    });

  todos
    .command('update')
    .description('Update a todo')
    .argument('<id>', 'todo id')
    .option('-t, --title <title>', 'new title')
    .option('-d, --description <text>', 'new description')
    .option('--done', 'mark as done')
    .option('--no-done', 'mark as not done')
    .action(async (id, { title, description, done }) => {
      const api = getApi();
      printJson(
        await unwrap(api, updateTodo({ client: api.client, path: { id }, body: { title, description, done } })),
      );
    });

  todos
    .command('rm')
    .description('Delete a todo')
    .argument('<id>', 'todo id')
    .action(async (id) => {
      const api = getApi();
      await unwrap(api, deleteTodo({ client: api.client, path: { id } }));
      console.log(`Deleted ${id}`);
    });

  return todos;
}
