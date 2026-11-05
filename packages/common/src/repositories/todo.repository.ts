import type { Todo } from '../domain/todo.ts';
import type { Transaction } from './transaction.ts';

/** Todos storage. Reads run immediately; writes join the given transaction and happen on its commit. */
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
