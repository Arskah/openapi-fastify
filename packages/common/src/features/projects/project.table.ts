import type { TableDefinition } from '../../db/table.ts';

export const projectsTable: TableDefinition = (config) => ({
  TableName: config.tables.projects,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
});
