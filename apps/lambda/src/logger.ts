import { pino, type Logger } from 'pino';
import type { LambdaConfig } from './config.ts';

export function createLogger(config: Pick<LambdaConfig, 'log'>): Logger {
  return pino({
    level: config.log.level,
    // pid and hostname say nothing in Lambda; the invocation bindings identify the sandbox
    base: null,
    ...(config.log.pretty && {
      transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } },
    }),
  });
}
