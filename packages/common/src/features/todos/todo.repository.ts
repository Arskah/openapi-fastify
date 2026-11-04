import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  type BatchGetCommandOutput,
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CommonConfig } from '../../config.ts';
import type { DynamoClient } from '../../db/dynamo.ts';
import type { WriteOp } from '../../db/transaction.ts';
import { ValidationError } from '../../errors.ts';
import type { Logger } from '../../logger.ts';
import type { Todo } from './todo.schema.ts';

export interface TodoRepository {
  /** Insert op for use in a transaction; fails if the id is taken. */
  createOp(todo: Todo): WriteOp;
  create(todo: Todo): Promise<void>;
  get(id: string): Promise<Todo | undefined>;
  /** Todos that exist among `ids`, in no particular order. */
  getMany(ids: string[]): Promise<Todo[]>;
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

  const put = (todo: Todo) => ({
    TableName,
    Item: todo,
    ConditionExpression: 'attribute_not_exists(id)',
  });

  return {
    createOp(todo) {
      log.debug({ id: todo.id }, 'queue put todo');
      return { Put: put(todo) };
    },

    async create(todo) {
      log.debug({ id: todo.id }, 'put todo');
      await dynamo.send(new PutCommand(put(todo)));
    },

    async get(id) {
      log.debug({ id }, 'get todo');
      const { Item } = await dynamo.send(new GetCommand({ TableName, Key: { id } }));
      return Item as Todo | undefined;
    },

    async getMany(ids) {
      log.debug({ count: ids.length }, 'batch get todos');
      const todos: Todo[] = [];
      // BatchGetItem accepts at most 100 keys per call
      for (let i = 0; i < ids.length; i += 100) {
        let keys: Record<string, unknown>[] | undefined = ids.slice(i, i + 100).map((id) => ({ id }));
        while (keys?.length) {
          const { Responses, UnprocessedKeys }: BatchGetCommandOutput = await dynamo.send(
            new BatchGetCommand({ RequestItems: { [TableName]: { Keys: keys } } }),
          );
          todos.push(...((Responses?.[TableName] ?? []) as Todo[]));
          keys = UnprocessedKeys?.[TableName]?.Keys;
        }
      }
      return todos;
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
