/**
 * An open transaction, as use cases see it. Repository write methods take it as
 * their first argument. How it commits is up to the integration behind it, but
 * every implementation (and every repository that takes it) keeps this contract:
 *
 * - Writes are deferred. A write method only records the write; nothing is
 *   stored until the root transaction commits, and reads, even within the same
 *   transaction, see only what was committed before.
 * - Commit is all or nothing.
 * - A write's precondition (exists, unchanged since, …) is checked on commit.
 *   A failed one makes `commit()` reject with the domain error the repository
 *   documents for that write (`NotFoundError`, `ConflictError`); write methods
 *   themselves return nothing and do not fail on stored state.
 * - A write method may throw immediately on misuse the integration cannot
 *   commit, e.g. writing the same entity twice or exceeding a size limit
 *   (DynamoDB: one write per item, at most 100 writes).
 *
 * A repository whose backend has no transactions (e.g. an HTTP API) does not
 * take a `Transaction`; its writes happen immediately and are not atomic with
 * anything else.
 */
export interface Transaction {
  /** Runs `fn` once this transaction has committed; skipped if it fails. */
  afterCommit(fn: () => void): void;
  /** Makes the commit fail with `cause`; for a joined part that failed. */
  rollbackOnly(cause: unknown): void;
}

/** A transaction plus the right to commit it; only whoever began it holds this. */
export interface RootTransaction extends Transaction {
  commit(): Promise<void>;
}
