import { projectsTableDefinition } from './projects.ts';
import type { TableDefinition } from './table.ts';
import { todosTableDefinition } from './todos.ts';

export type { TableDefinition } from './table.ts';

/** Every table common needs; `pnpm db:init` creates them. */
export const tables: TableDefinition[] = [todosTableDefinition, projectsTableDefinition];
