#!/usr/bin/env node
import { ApiRequestError } from '@demo/api-client';
import { buildApplication, buildRouteMap, run, text_en } from '@stricli/core';
import { projectsRoutes } from './commands/projects.ts';
import { todosRoutes } from './commands/todos.ts';
import type { CliContext } from './context.ts';

const root = buildRouteMap({
  routes: { todos: todosRoutes, projects: projectsRoutes },
  docs: { brief: 'CLI for the Todos API' },
});

const app = buildApplication<CliContext>(root, {
  name: 'demo',
  scanner: { caseStyle: 'allow-kebab-for-camel' },
  localization: {
    loadText: () => ({
      ...text_en,
      // Stack traces are noise for API failures; show the status and the request ID to grep server logs for
      formatException: (error) =>
        error instanceof ApiRequestError
          ? `Error ${error.status}: ${error.message} (request ${error.requestId})`
          : error instanceof Error
            ? error.message
            : String(error),
    }),
  },
});

await run(app, process.argv.slice(2), { process });
