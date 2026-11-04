import type { TableDefinition } from '../../db/table.ts';

export const todosTable: TableDefinition = (config) => ({
  TableName: config.tables.todos,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
});
