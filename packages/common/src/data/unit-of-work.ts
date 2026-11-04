import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from '../logger.ts';
import type { DynamoClient } from './dynamo.ts';
import { commitWrites, MAX_WRITES, type Write } from './transaction.ts';

interface Work {
  writes: Write[];
  hooks: (() => void)[];
  committed: boolean;
}

const storage = new AsyncLocalStorage<Work>();

function current(action: string): Work {
  const work = storage.getStore();
  if (!work) throw new Error(`${action} must run inside a unit of work (define the caller with useCase())`);
  if (work.committed) throw new Error(`${action} after the unit of work committed`);
  return work;
}

/**
 * Queues a write in the current unit of work; repositories call this for all
 * writes. Nothing is written until the outermost unit of work commits, so reads
 * in the meantime do not see staged writes.
 */
export function stageWrite(write: Write): void {
  const work = current('Repository writes');
  if (work.writes.some(({ item }) => item === write.item)) {
    throw new Error(`Unit of work already writes ${write.item}; DynamoDB allows one write per item per transaction`);
  }
  if (work.writes.length >= MAX_WRITES) {
    throw new RangeError(`Unit of work exceeds ${MAX_WRITES} writes, the DynamoDB transaction limit`);
  }
  work.writes.push(write);
}

/** Runs `fn` once the outermost unit of work has committed; skipped if it fails. */
export function afterCommit(fn: () => void): void {
  current('afterCommit').hooks.push(fn);
}

/**
 * Runs `fn` in a unit of work and commits its staged writes atomically. Inside
 * another unit of work it joins that one instead, so composed use cases commit
 * together.
 */
export type UnitOfWorkRunner = <T>(fn: () => Promise<T>) => Promise<T>;

export function createUnitOfWorkRunner({ dynamo, logger }: { dynamo: DynamoClient; logger: Logger }): UnitOfWorkRunner {
  const log = logger.child({ component: 'UnitOfWork' });

  return async (fn) => {
    if (storage.getStore()) return fn();

    const work: Work = { writes: [], hooks: [], committed: false };
    const result = await storage.run(work, fn);
    work.committed = true;

    if (work.writes.length > 0) {
      log.debug({ writes: work.writes.map(({ item }) => item) }, 'commit');
      await commitWrites(dynamo, work.writes);
    }
    for (const hook of work.hooks) {
      try {
        hook();
      } catch (error) {
        // The writes are committed; a failing side effect must not report the use case as failed
        log.error({ err: error }, 'afterCommit hook failed');
      }
    }
    return result;
  };
}
