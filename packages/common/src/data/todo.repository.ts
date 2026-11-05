import { BatchGetCommand, type BatchGetCommandOutput, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { Todo } from '../domain/todo.ts';
import { ConflictError, NotFoundError, ValidationError } from '../errors.ts';
import type { RepositoryDeps } from './deps.ts';
import { todosTable } from './tables/todos.ts';
import type { Transaction } from './unit-of-work.ts';

/** Reads run immediately; writes are staged in the given transaction. */
export interface TodoRepository {
  get(id: string): Promise<Todo | undefined>;
  /** Todos that exist among `ids`, in the order given. */
  getMany(ids: readonly string[]): Promise<Todo[]>;
  list(options: { limit: number; cursor?: string }): Promise<{ items: Todo[]; nextCursor?: string }>;
  create(tx: Transaction, todo: Todo): void;
  /** Saves `todo` if the stored one is unchanged since `expectedUpdatedAt`; else ConflictError on commit. */
  replace(tx: Transaction, todo: Todo, expectedUpdatedAt: string): void;
  delete(tx: Transaction, id: string): void;
}

export function createTodoRepository({ config, logger, dynamo }: RepositoryDeps): TodoRepository {
  const table = todosTable(config);
  const { TableName } = table;
  const log = logger.child({ component: 'TodoRepository' });

  return {
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

    create(tx, todo) {
      log.debug({ id: todo.id }, 'stage insert todo');
      tx.stage({
        op: table.insert(todo),
        item: table.item(todo.id),
        onConditionFailed: () => new ConflictError(`Todo '${todo.id}' already exists`),
      });
    },

    replace(tx, todo, expectedUpdatedAt) {
      log.debug({ id: todo.id }, 'stage replace todo');
      tx.stage({
        op: table.replace(todo, expectedUpdatedAt),
        item: table.item(todo.id),
        onConditionFailed: () => new ConflictError(`Todo '${todo.id}' was modified or deleted concurrently`),
      });
    },

    delete(tx, id) {
      log.debug({ id }, 'stage delete todo');
      tx.stage({
        op: table.delete(id),
        item: table.item(id),
        onConditionFailed: () => new NotFoundError('Todo', id),
      });
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
