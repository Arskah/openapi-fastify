// Storage format of todos. No I/O.
import type { CommonConfig } from '../../config.ts';
import { TodoSchema, type Todo } from '../../domain/todo.ts';
import type { WriteOp } from '../transaction.ts';
import type { TableDefinition } from './table.ts';

export const todosTableDefinition: TableDefinition = (config) => ({
  TableName: config.tables.todos,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
});

export function todosTable(config: CommonConfig) {
  const TableName = config.tables.todos;

  return {
    TableName,
    key: (id: string) => ({ id }),
    item: (id: string) => `${TableName}#${id}`,
    fromItem: (item: Record<string, unknown>): Todo => TodoSchema.parse(item),

    /** Insert; fails if the id is taken. */
    insert: (todo: Todo) =>
      ({
        Put: { TableName, Item: todo, ConditionExpression: 'attribute_not_exists(id)' },
      }) satisfies WriteOp,

    /** Replace; fails unless the stored todo is unchanged since `expectedUpdatedAt` (optimistic locking). */
    replace: (todo: Todo, expectedUpdatedAt: string) =>
      ({
        Put: {
          TableName,
          Item: todo,
          ConditionExpression: 'updatedAt = :expectedUpdatedAt',
          ExpressionAttributeValues: { ':expectedUpdatedAt': expectedUpdatedAt },
        },
      }) satisfies WriteOp,

    /** Delete; fails if the todo does not exist. */
    delete: (id: string) =>
      ({
        Delete: { TableName, Key: { id }, ConditionExpression: 'attribute_exists(id)' },
      }) satisfies WriteOp,
  };
}
