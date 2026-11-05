import type { Logger } from '../logger.ts';

/**
 * What every use case gets. Each declares the rest by naming the ports it uses,
 * e.g. `{ todoRepository: TodoRepository }`; any `ctx` of that shape works,
 * such as the container or a test fake.
 */
export interface UseCaseContext {
  logger: Logger;
}

/**
 * Defines a use case: a plain function `(ctx, ...args)` that logs with
 * `{ useCase: name }`.
 *
 * A use case that writes declares its atomicity with `useTransaction()`. A
 * caller passes its own `ctx`, so its declared dependencies must include those
 * of every use case it calls, and an open transaction travels with it.
 */
export function useCase<D extends UseCaseContext, A extends unknown[], R>(
  name: string,
  fn: (ctx: D, ...args: A) => Promise<R>,
): (ctx: D, ...args: A) => Promise<R> {
  return (ctx, ...args) => fn({ ...ctx, logger: ctx.logger.child({ useCase: name }) }, ...args);
}
