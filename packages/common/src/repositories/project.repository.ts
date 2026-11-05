import type { Project } from '../domain/project.ts';
import type { Transaction } from './transaction.ts';

/** Projects storage. Reads run immediately; writes join the given transaction and happen on its commit. */
export interface ProjectRepository {
  /** `consistent` reads see writes committed just before. */
  get(id: string, options?: { consistent?: boolean }): Promise<Project | undefined>;
  create(tx: Transaction, project: Project): void;
  /** Atomic append; NotFoundError on commit if the project does not exist. */
  appendTodos(tx: Transaction, id: string, todoIds: readonly string[], updatedAt: string): void;
  /** Removes `todoId` found at `index`; ConflictError on commit if the list changed meanwhile. */
  removeTodoAt(tx: Transaction, id: string, index: number, todoId: string, updatedAt: string): void;
}
