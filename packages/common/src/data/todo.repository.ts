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
import type { Todo, TodoPatch } from '../domain/todo.ts';
import { ValidationError } from '../errors.ts';
import type { RepositoryDeps } from './deps.ts';
import { todosTable } from './tables/todos.ts';

export interface TodoRepository {
  create(todo: Todo): Promise<void>;
  get(id: string): Promise<Todo | undefined>;
  /** Todos that exist among `ids`, in the order given. */
  getMany(ids: readonly string[]): Promise<Todo[]>;
  list(options: { limit: number; cursor?: string }): Promise<{ items: Todo[]; nextCursor?: string }>;
  update(id: string, patch: TodoPatch): Promise<Todo | undefined>;
  delete(id: string): Promise<Todo | undefined>;
}

export function createTodoRepository({ config, logger, dynamo }: RepositoryDeps): TodoRepository {
  const table = todosTable(config);
  const { TableName } = table;
  const log = logger.child({ component: 'TodoRepository' });

  return {
    async create(todo) {
      log.debug({ id: todo.id }, 'put todo');
      await dynamo.send(new PutCommand(table.put(todo).Put));
    },

    async get(id) {
      log.debug({ id }, 'get todo');
      const { Item } = await dynamo.send(new GetCommand({ TableName, Key: table.key(id) }));
      return Item && table.fromItem(Item);
    },

    async getMany(ids) {
      log.debug({ count: ids.length }, 'batch get todos');
      const byId = new Map<string, Todo>();
      const unique = [...new Set(ids)];
      // BatchGetItem accepts at most 100 keys per call
      for (let i = 0; i < unique.length; i += 100) {
        let keys: Record<string, unknown>[] | undefined = unique.slice(i, i + 100).map(table.key);
        while (keys?.length) {
          const { Responses, UnprocessedKeys }: BatchGetCommandOutput = await dynamo.send(
            new BatchGetCommand({ RequestItems: { [TableName]: { Keys: keys } } }),
          );
          for (const item of Responses?.[TableName] ?? []) {
            const todo = table.fromItem(item);
            byId.set(todo.id, todo);
          }
          keys = UnprocessedKeys?.[TableName]?.Keys;
        }
      }
      return ids.flatMap((id) => byId.get(id) ?? []);
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
        items: Items.map(table.fromItem),
        nextCursor: LastEvaluatedKey ? encodeCursor(LastEvaluatedKey) : undefined,
      };
    },

    async update(id, patch) {
      log.debug({ id, fields: Object.keys(patch) }, 'update todo');
      try {
        const { Attributes } = await dynamo.send(
          new UpdateCommand({ ...table.update(id, patch).Update, ReturnValues: 'ALL_NEW' }),
        );
        return Attributes && table.fromItem(Attributes);
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return undefined;
        throw error;
      }
    },

    async delete(id) {
      log.debug({ id }, 'delete todo');
      const { Attributes } = await dynamo.send(
        new DeleteCommand({ TableName, Key: table.key(id), ReturnValues: 'ALL_OLD' }),
      );
      return Attributes && table.fromItem(Attributes);
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
