#!/usr/bin/env node
import { buildApplication, buildRouteMap, run } from '@stricli/core';
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
});

await run(app, process.argv.slice(2), { process });
