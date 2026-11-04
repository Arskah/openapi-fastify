import { pino, type Logger } from 'pino';
import type { ServerConfig } from './config.ts';

export function createLogger(config: Pick<ServerConfig, 'log'>): Logger {
  return pino({
    level: config.log.level,
    ...(config.log.pretty && {
      transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } },
    }),
  });
}
