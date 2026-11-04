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
    item: (id: string) => `${TableName}#${id}`,
    fromItem: (item: Record<string, unknown>): Project => ProjectSchema.parse(item),

    /** Insert; fails if the id is taken. */
    insert: (project: Project) =>
      ({
        Put: { TableName, Item: project, ConditionExpression: 'attribute_not_exists(id)' },
      }) satisfies WriteOp,

    /** Atomic append to `todoIds`; fails if the project does not exist. */
    appendTodos: (id: string, todoIds: readonly string[], updatedAt: string) =>
      ({
        Update: {
          TableName,
          Key: { id },
          ConditionExpression: 'attribute_exists(id)',
          UpdateExpression: 'SET todoIds = list_append(todoIds, :todoIds), updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':todoIds': todoIds, ':updatedAt': updatedAt },
        },
      }) satisfies WriteOp,

    /**
     * Removes `todoIds[index]`; fails unless that position still holds `todoId`,
     * so a concurrent change to the list cannot make it remove the wrong id.
     */
    removeTodoAt: (id: string, index: number, todoId: string, updatedAt: string) =>
      ({
        Update: {
          TableName,
          Key: { id },
          ConditionExpression: `todoIds[${index}] = :todoId`,
          UpdateExpression: `REMOVE todoIds[${index}] SET updatedAt = :updatedAt`,
          ExpressionAttributeValues: { ':todoId': todoId, ':updatedAt': updatedAt },
        },
      }) satisfies WriteOp,
  };
}
