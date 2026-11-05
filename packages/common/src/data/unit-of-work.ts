import type { Logger } from '../logger.ts';
import type { DynamoClient } from './dynamo.ts';
import { commitWrites, MAX_WRITES, type Write } from './transaction.ts';

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

/** A transaction plus the right to commit it; held by whoever began it. */
export interface UnitOfWork extends Transaction {
  /** Commits the staged writes atomically, then runs the `afterCommit` hooks. */
  commit(): Promise<void>;
}

export type BeginUnitOfWork = () => UnitOfWork;

export function createUnitOfWorkFactory({ dynamo, logger }: { dynamo: DynamoClient; logger: Logger }): BeginUnitOfWork {
  const log = logger.child({ component: 'UnitOfWork' });

  return () => {
    const writes: Write[] = [];
    const hooks: (() => void)[] = [];
    let committed = false;
    let failure: { cause: unknown } | undefined;

    const open = (action: string) => {
      if (committed) throw new Error(`${action} after the unit of work committed`);
    };

    return {
      stage(write) {
        open('Repository writes');
        if (writes.some(({ item }) => item === write.item)) {
          throw new Error(`Unit of work already writes ${write.item}; DynamoDB allows one write per item per transaction`);
        }
        if (writes.length >= MAX_WRITES) {
          throw new RangeError(`Unit of work exceeds ${MAX_WRITES} writes, the DynamoDB transaction limit`);
        }
        writes.push(write);
      },

      afterCommit(fn) {
        open('afterCommit');
        hooks.push(fn);
      },

      rollbackOnly(cause) {
        failure ??= { cause };
      },

      async commit() {
        open('commit');
        committed = true;
        if (failure) {
          throw new Error('Unit of work is rollback-only: a joined use case failed', { cause: failure.cause });
        }
        if (writes.length > 0) {
          log.debug({ writes: writes.map(({ item }) => item) }, 'commit');
          await commitWrites(dynamo, writes);
        }
        for (const hook of hooks) {
          try {
            hook();
          } catch (error) {
            // The writes are committed; a failing side effect must not report the use case as failed
            log.error({ err: error }, 'afterCommit hook failed');
          }
        }
      },
    };
  };
}
