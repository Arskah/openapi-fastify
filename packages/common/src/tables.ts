import type { TableDefinition } from './db/table.ts';
import { projectsTable } from './features/projects/index.ts';
import { todosTable } from './features/todos/index.ts';

/** Every table common needs. Add a feature's table here alongside its module. */
export const tables: TableDefinition[] = [todosTable, projectsTable];
