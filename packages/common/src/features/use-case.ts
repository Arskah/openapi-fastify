import type { Container } from '../container.ts';

/** What every use case gets; each declares the rest with `Pick<Container, …>`. */
export type UseCaseContext = Pick<Container, 'logger' | 'unitOfWork'>;

/**
 * Defines a use case: a plain function `(ctx, ...args)` that runs in a unit of
 * work and logs with `{ useCase: name }`.
 *
 * Called directly (e.g. from a route) it commits its own writes. Called from
 * another use case it joins the caller's unit of work, so composed use cases
 * commit atomically. A caller passes its own `ctx`, so its declared
 * dependencies must include those of every use case it calls.
 */
export function useCase<D extends UseCaseContext, A extends unknown[], R>(
  name: string,
  fn: (ctx: D, ...args: A) => Promise<R>,
): (ctx: D, ...args: A) => Promise<R> {
  return (ctx, ...args) => ctx.unitOfWork(() => fn({ ...ctx, logger: ctx.logger.child({ useCase: name }) }, ...args));
}
