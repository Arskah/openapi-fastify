import type { Container } from '../container.ts';

/** What every use case gets; each declares the rest with `Pick<Container, …>`. */
export type UseCaseContext = Pick<Container, 'logger'>;

/**
 * Defines a use case: a plain function `(ctx, ...args)` that logs with
 * `{ useCase: name }`.
 *
 * A use case that writes decides its own atomicity with `transaction()`. A
 * caller passes its own `ctx`, so its declared dependencies must include those
 * of every use case it calls, and an open transaction travels with it.
 */
export function useCase<D extends UseCaseContext, A extends unknown[], R>(
  name: string,
  fn: (ctx: D, ...args: A) => Promise<R>,
): (ctx: D, ...args: A) => Promise<R> {
  return (ctx, ...args) => fn({ ...ctx, logger: ctx.logger.child({ useCase: name }) }, ...args);
}
