import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger, LogFn } from './logger.ts';

export interface RequestContext {
  /** Logger for the current unit of work, e.g. Fastify's `request.log` (carries `requestId`). */
  logger: Logger;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` (and everything it awaits or schedules) within `context`. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

/**
 * Logger that writes through the current context's logger, or `fallback`
 * outside any context (startup, scripts).
 *
 * Services are created once and hold this logger, yet their log lines still
 * carry per-request bindings such as `requestId`. Bindings from `child()` are
 * applied on top of whichever logger is current.
 */
export function createContextLogger(fallback: Logger, bindings?: Record<string, unknown>): Logger {
  // One child per underlying logger; entries go away with the request's logger.
  const children = new WeakMap<Logger, Logger>();

  const current = (): Logger => {
    const base = storage.getStore()?.logger ?? fallback;
    if (!bindings) return base;
    let child = children.get(base);
    if (!child) {
      child = base.child(bindings);
      children.set(base, child);
    }
    return child;
  };

  const method = (level: (typeof LEVELS)[number]): LogFn =>
    ((...args: Parameters<LogFn>) => {
      const logger = current();
      (logger[level] as (...args: Parameters<LogFn>) => void).apply(logger, args);
    }) as LogFn;

  return {
    trace: method('trace'),
    debug: method('debug'),
    info: method('info'),
    warn: method('warn'),
    error: method('error'),
    child: (more) => createContextLogger(fallback, { ...bindings, ...more }),
  };
}
