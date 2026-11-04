// Storage format of todos. No I/O: repositories that write todos, in their own
// transactions or another entity's, build ops from here.
import type { CommonConfig } from '../../config.ts';
import { TodoSchema, type Todo, type TodoPatch } from '../../domain/todo.ts';
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
    fromItem: (item: Record<string, unknown>): Todo => TodoSchema.parse(item),

    /** Insert; fails if the id is taken. */
    put: (todo: Todo) =>
      ({
        Put: { TableName, Item: todo, ConditionExpression: 'attribute_not_exists(id)' },
      }) satisfies WriteOp,

    /** Partial update of an existing todo. */
    update: (id: string, patch: TodoPatch) => {
      const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
      return {
        Update: {
          TableName,
          Key: { id },
          ConditionExpression: 'attribute_exists(id)',
          UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(', ')}`,
          ExpressionAttributeNames: Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
          ExpressionAttributeValues: Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value])),
        },
      } satisfies WriteOp;
    },
  };
}
