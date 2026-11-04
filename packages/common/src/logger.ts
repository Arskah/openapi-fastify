/**
 * Minimal structured logger contract used across common code.
 *
 * Pino (and therefore Fastify's `request.log`) satisfies this interface, so the
 * server can hand its request-scoped logger straight to business logic and every
 * log line produced in common carries the request ID.
 */
export interface LogFn {
  (obj: Record<string, unknown>, msg?: string): void;
  (msg: string): void;
}

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}
