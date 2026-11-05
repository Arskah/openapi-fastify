import type { Todo } from '../domain/todo.ts';
import type { Transaction } from './transaction.ts';

/**
 * Todos storage. Reads run immediately and may not reflect writes committed just
 * before (eventually consistent). Writes follow the `Transaction` contract: they
 * happen on commit, and the errors below are raised by the commit.
 */
export interface TodoRepository {
  get(id: string): Promise<Todo | undefined>;
  /** Todos that exist among `ids`, in the order given. */
  getMany(ids: readonly string[]): Promise<Todo[]>;
  /** A page of todos in storage order; `nextCursor` is opaque. ValidationError for an invalid cursor. */
  list(options: { limit: number; cursor?: string }): Promise<{ items: Todo[]; nextCursor?: string }>;
  /** ConflictError if the id is taken. */
  create(tx: Transaction, todo: Todo): void;
  /** Saves `todo` if the stored one is unchanged since `expectedUpdatedAt`; else ConflictError. */
  replace(tx: Transaction, todo: Todo, expectedUpdatedAt: string): void;
  /** NotFoundError if the todo does not exist. */
  delete(tx: Transaction, id: string): void;
}
