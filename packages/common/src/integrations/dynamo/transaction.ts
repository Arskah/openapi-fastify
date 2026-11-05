import type { Logger } from '../../logger.ts';
import type { DynamoClient } from './client.ts';
import type { RootTransaction, Transaction } from '../../ports/transaction.ts';
import { MAX_WRITES, type Write } from './write.ts';

/**
 * A DynamoDB transaction. DynamoDB transactions are one batch call, so this is a
 * unit of work: it collects writes and submits them together on `commit()`.
 * Only whoever began it (`useTransaction()`) commits it.
 */
export class DynamoTransaction implements RootTransaction {
  /**
   * The DynamoDB transaction behind `tx`. DynamoDB repositories can only join a
   * DynamoDB transaction; any other kind is a wiring error.
   */
  static of(tx: Transaction): DynamoTransaction {
    if (tx instanceof DynamoTransaction) return tx;
    throw new TypeError('DynamoDB repositories need a DynamoDB transaction; check the container wiring');
  }

  readonly #dynamo: DynamoClient;
  readonly #log: Logger;
  readonly #writes: Write[] = [];
  readonly #hooks: (() => void | Promise<void>)[] = [];
  #committed = false;
  #failure: { cause: unknown } | undefined;

  constructor(dynamo: DynamoClient, log: Logger) {
    this.#dynamo = dynamo;
    this.#log = log;
  }

  /** For repositories: queues a write in this transaction. */
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

  afterCommit(fn: () => void | Promise<void>): void {
    this.#assertOpen('afterCommit');
    this.#hooks.push(fn);
  }

  rollbackOnly(cause: unknown): void {
    this.#failure ??= { cause };
  }

  /** Commits the staged writes atomically, then awaits the `afterCommit` hooks in order. */
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
        await hook();
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
