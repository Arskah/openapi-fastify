import type { Project } from '../domain/project.ts';
import type { Transaction } from './transaction.ts';

/**
 * Projects storage. Reads run immediately and are eventually consistent unless
 * `consistent`. Writes follow the `Transaction` contract: they happen on commit,
 * and the errors below are raised by the commit.
 */
export interface ProjectRepository {
  /** With `consistent`, the read sees every write committed before it. */
  get(id: string, options?: { consistent?: boolean }): Promise<Project | undefined>;
  /** ConflictError if the id is taken. */
  create(tx: Transaction, project: Project): void;
  /** Atomic append; NotFoundError if the project does not exist. */
  appendTodos(tx: Transaction, id: string, todoIds: readonly string[], updatedAt: string): void;
  /** Removes `todoId` found at `index`; ConflictError if that position no longer holds it. */
  removeTodoAt(tx: Transaction, id: string, index: number, todoId: string, updatedAt: string): void;
}
