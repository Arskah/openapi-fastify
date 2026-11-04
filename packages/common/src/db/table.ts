import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type { CommonConfig } from '../config.ts';

/** How a feature's table is created; used by `scripts/create-table.ts` and tests. */
export type TableDefinition = (config: CommonConfig) => CreateTableCommandInput;
