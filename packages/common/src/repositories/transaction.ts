/**
 * An open transaction, as use cases see it. Repository write methods take it as
 * their first argument; what they write happens when the transaction commits,
 * all or nothing. How it commits is up to the integration behind it.
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
