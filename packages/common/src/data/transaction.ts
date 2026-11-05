import type { Logger } from '../logger.ts';
import type { DynamoClient } from './dynamo.ts';
import { MAX_WRITES, type Write } from './write.ts';

/**
 * An open transaction, as seen by use cases and repositories. Repository write
 * methods take it as their first argument and stage into it; nothing is written
 * until its owner commits, so reads in the meantime do not see staged writes.
 */
export interface Transaction {
  /** For repositories: queues a write in this transaction. */
  stage(write: Write): void;
  /** Runs `fn` once this transaction has committed; skipped if it fails. */
  afterCommit(fn: () => void): void;
  /** Makes `commit()` fail with `cause`; for a joined part that failed. */
  rollbackOnly(cause: unknown): void;
}

/**
 * A DynamoDB transaction. DynamoDB transactions are one batch call, so this is a
 * unit of work: it collects writes and submits them together on `commit()`.
 * Only whoever began it (`useTransaction()`) commits it.
 */
export class DynamoTransaction implements Transaction {
  readonly #dynamo: DynamoClient;
  readonly #log: Logger;
  readonly #writes: Write[] = [];
  readonly #hooks: (() => void)[] = [];
  #committed = false;
  #failure: { cause: unknown } | undefined;

  constructor(dynamo: DynamoClient, log: Logger) {
    this.#dynamo = dynamo;
    this.#log = log;
  }

  stage(write: Write): void {
    this.#assertOpen('Repository writes');
    if (this.#writes.some(({ item }) => item === write.item)) {
      throw new Error(`Transaction already writes ${write.item}; DynamoDB allows one write per item per transaction`);
    }
    if (this.#writes.length >= MAX_WRITES) {
      throw new RangeError(`Transaction exceeds ${MAX_WRITES} writes, the DynamoDB limit`);
    }
    this.#writes.push(write);
  }

  afterCommit(fn: () => void): void {
    this.#assertOpen('afterCommit');
    this.#hooks.push(fn);
  }

  rollbackOnly(cause: unknown): void {
    this.#failure ??= { cause };
  }

  /** Commits the staged writes atomically, then runs the `afterCommit` hooks. */
  async commit(): Promise<void> {
    this.#assertOpen('commit');
    this.#committed = true;
    if (this.#failure) {
      throw new Error('Transaction is rollback-only: a joined use case failed', { cause: this.#failure.cause });
    }
    if (this.#writes.length > 0) {
      this.#log.debug({ writes: this.#writes.map(({ item }) => item) }, 'commit');
      await this.#dynamo.writeAtomically(this.#writes);
    }
    for (const hook of this.#hooks) {
      try {
        hook();
      } catch (error) {
        // The writes are committed; a failing side effect must not report the use case as failed
        this.#log.error({ err: error }, 'afterCommit hook failed');
      }
    }
  }

  #assertOpen(action: string): void {
    if (this.#committed) throw new Error(`${action} after the transaction committed`);
  }
}
