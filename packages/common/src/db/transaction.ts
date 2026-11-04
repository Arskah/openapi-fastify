import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { TransactWriteCommand, type TransactWriteItem } from '@aws-sdk/lib-dynamodb';
import type { Logger } from '../logger.ts';
import type { DynamoClient } from './dynamo.ts';

/** One write in a DynamoDB transaction. Repositories build these; they own table and key details. */
export type WriteOp = TransactWriteItem;

export interface WriteOptions {
  /** Error to throw when this op's condition check cancels the transaction. */
  onConditionFailed?: () => Error;
}

export interface Transaction {
  write(op: WriteOp, options?: WriteOptions): void;
  /** Runs after a successful commit, e.g. logging or publishing events. */
  afterCommit(fn: () => void): void;
}

/** Lets a service write on its own or as part of a caller's transaction. */
export interface WriteContext {
  tx?: Transaction;
}

/**
 * Runs `fn`, then commits every op it queued in one `TransactWriteItems` call.
 * Nothing is written if `fn` throws or any condition fails.
 */
export type RunTransaction = <T>(fn: (tx: Transaction) => Promise<T>) => Promise<T>;

// DynamoDB limit per TransactWriteItems call
const MAX_OPS = 100;

export function createTransactionRunner({ dynamo, logger }: { dynamo: DynamoClient; logger: Logger }): RunTransaction {
  const log = logger.child({ component: 'Transaction' });

  return async (fn) => {
    const queued: { op: WriteOp; options: WriteOptions }[] = [];
    const hooks: (() => void)[] = [];
    let open = true;

    const result = await fn({
      write(op, options = {}) {
        if (!open) throw new Error('Transaction already committed');
        queued.push({ op, options });
      },
      afterCommit(hook) {
        hooks.push(hook);
      },
    });
    open = false;

    if (queued.length > MAX_OPS) {
      throw new Error(`Transaction has ${queued.length} writes; DynamoDB allows at most ${MAX_OPS}`);
    }
    if (queued.length > 0) {
      log.debug({ writes: queued.length }, 'commit transaction');
      try {
        await dynamo.send(new TransactWriteCommand({ TransactItems: queued.map(({ op }) => op) }));
      } catch (error) {
        // CancellationReasons line up with TransactItems, so map the failing op to its owner's error
        if (error instanceof TransactionCanceledException) {
          const index = error.CancellationReasons?.findIndex((reason) => reason.Code === 'ConditionalCheckFailed');
          const mapped = index === undefined ? undefined : queued[index]?.options.onConditionFailed?.();
          if (mapped) throw mapped;
        }
        throw error;
      }
    }

    for (const hook of hooks) hook();
    return result;
  };
}
