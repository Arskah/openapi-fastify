#!/usr/bin/env node
import { Command, Option } from '@commander-js/extra-typings';
import { ApiRequestError, createApi } from './api.ts';
import { projectsCommand } from './commands/projects.ts';
import { todosCommand } from './commands/todos.ts';

const program = new Command()
  .name('demo')
  .description('CLI for the Todos API')
  .addOption(new Option('--api-url <url>', 'API base URL').env('API_URL').default('http://localhost:3000'))
  .addOption(new Option('--request-id <id>', 'request ID to send (default: random UUID)').env('REQUEST_ID'))
  .option('-v, --verbose', 'log requests to stderr');

const getApi = () => createApi(program.opts());

program.addCommand(todosCommand(getApi));
program.addCommand(projectsCommand(getApi));

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof ApiRequestError) {
    console.error(`Error ${error.status}: ${error.message} (request ${error.requestId})`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
