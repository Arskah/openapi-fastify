// Storage format of projects. No I/O.
import type { CommonConfig } from '../../config.ts';
import { ProjectSchema, type Project } from '../../domain/project.ts';
import type { WriteOp } from '../transaction.ts';
import type { TableDefinition } from './table.ts';

export const projectsTableDefinition: TableDefinition = (config) => ({
  TableName: config.tables.projects,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
});

export function projectsTable(config: CommonConfig) {
  const TableName = config.tables.projects;

  return {
    TableName,
    key: (id: string) => ({ id }),
    fromItem: (item: Record<string, unknown>): Project => ProjectSchema.parse(item),

    /** Insert; fails if the id is taken. */
    put: (project: Project) =>
      ({
        Put: { TableName, Item: project, ConditionExpression: 'attribute_not_exists(id)' },
      }) satisfies WriteOp,

    /** Appends to `todoIds`; fails if the project does not exist. */
    appendTodo: (id: string, todoId: string, updatedAt: string) =>
      ({
        Update: {
          TableName,
          Key: { id },
          ConditionExpression: 'attribute_exists(id)',
          UpdateExpression: 'SET todoIds = list_append(todoIds, :todoIds), updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':todoIds': [todoId], ':updatedAt': updatedAt },
        },
      }) satisfies WriteOp,
  };
}
