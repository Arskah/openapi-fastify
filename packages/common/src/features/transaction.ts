import type { RootTransaction, Transaction } from '../repositories/transaction.ts';

/** What a transactional use case needs besides its repositories. */
export interface TransactionDeps {
  beginTransaction(): RootTransaction;
}

/** `ctx` inside a `useTransaction()` use case: repository writes take `ctx.tx`. */
export type Transactional<D> = D & { tx: Transaction };

/**
 * Declares a use case transactional: the writes it stages commit atomically
 * when it returns, and none do if it throws.
 *
 * Called with a `ctx` that already carries a transaction (from another
 * transactional use case), it joins that one and the outermost commits. If a
 * joined use case throws, the whole transaction is marked rollback-only, so a
 * caller that catches the error cannot commit the callee's half-staged writes.
 */
export function useTransaction<D extends TransactionDeps, A extends unknown[], R>(
  fn: (ctx: Transactional<D>, ...args: A) => Promise<R>,
): (ctx: D & { tx?: Transaction }, ...args: A) => Promise<R> {
  return async (ctx, ...args) => {
    const { tx } = ctx;
    if (tx) {
      try {
        return await fn({ ...ctx, tx }, ...args);
      } catch (error) {
        tx.rollbackOnly(error);
        throw error;
      }
    }

    const root = ctx.beginTransaction();
    const result = await fn({ ...ctx, tx: root }, ...args);
    await root.commit();
    return result;
  };
}
