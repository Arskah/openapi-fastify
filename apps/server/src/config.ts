import { CommonConfigSchema, commonConfigFromEnv } from '@demo/common';
import { z } from 'zod';

export const ServerConfigSchema = CommonConfigSchema.extend({
  server: z.object({
    host: z.string().min(1),
    port: z.coerce.number().int().min(0).max(65535),
  }),
  log: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
    pretty: z.stringbool(),
  }),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return ServerConfigSchema.parse({
    ...commonConfigFromEnv(env),
    server: {
      host: env.HOST ?? '127.0.0.1',
      port: env.PORT ?? '3000',
    },
    log: {
      level: env.LOG_LEVEL ?? 'info',
      pretty: env.LOG_PRETTY ?? 'false',
    },
  });
}
