import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CommonConfig } from '../../config.ts';
import type { DynamoClient } from '../../db/dynamo.ts';
import { ValidationError } from '../../errors.ts';
import type { Logger } from '../../logger.ts';
import type { Todo } from './todo.schema.ts';

export interface TodoRepository {
  create(todo: Todo): Promise<void>;
  get(id: string): Promise<Todo | undefined>;
  list(options: { limit: number; cursor?: string }): Promise<{ items: Todo[]; nextCursor?: string }>;
  update(id: string, changes: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo | undefined>;
  delete(id: string): Promise<Todo | undefined>;
}

export interface TodoRepositoryDeps {
  config: CommonConfig;
  logger: Logger;
  dynamo: DynamoClient;
}

export function createTodoRepository({ config, logger, dynamo }: TodoRepositoryDeps): TodoRepository {
  const TableName = config.tables.todos;
  const log = logger.child({ component: 'TodoRepository' });

  return {
    async create(todo) {
      log.debug({ id: todo.id }, 'put todo');
      await dynamo.send(
        new PutCommand({
          TableName,
          Item: todo,
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
    },

    async get(id) {
      log.debug({ id }, 'get todo');
      const { Item } = await dynamo.send(new GetCommand({ TableName, Key: { id } }));
      return Item as Todo | undefined;
    },

    async list({ limit, cursor }) {
      log.debug({ limit, cursor }, 'scan todos');
      const { Items = [], LastEvaluatedKey } = await dynamo.send(
        new ScanCommand({
          TableName,
          Limit: limit,
          ExclusiveStartKey: cursor ? decodeCursor(cursor) : undefined,
        }),
      );
      return {
        items: Items as Todo[],
        nextCursor: LastEvaluatedKey ? encodeCursor(LastEvaluatedKey) : undefined,
      };
    },

    async update(id, changes) {
      const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
      log.debug({ id, fields: entries.map(([key]) => key) }, 'update todo');

      try {
        const { Attributes } = await dynamo.send(
          new UpdateCommand({
            TableName,
            Key: { id },
            ConditionExpression: 'attribute_exists(id)',
            UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(', ')}`,
            ExpressionAttributeNames: Object.fromEntries(entries.map(([key]) => [`#${key}`, key])),
            ExpressionAttributeValues: Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value])),
            ReturnValues: 'ALL_NEW',
          }),
        );
        return Attributes as Todo;
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return undefined;
        throw error;
      }
    },

    async delete(id) {
      log.debug({ id }, 'delete todo');
      const { Attributes } = await dynamo.send(
        new DeleteCommand({ TableName, Key: { id }, ReturnValues: 'ALL_OLD' }),
      );
      return Attributes as Todo | undefined;
    },
  };
}

function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const key: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (key && typeof key === 'object' && typeof (key as { id?: unknown }).id === 'string') {
      return { id: (key as { id: string }).id };
    }
  } catch {
    // fall through
  }
  throw new ValidationError('Invalid cursor');
}
