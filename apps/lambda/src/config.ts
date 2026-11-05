import { CommonConfigSchema, commonConfigFromEnv } from '@demo/common';
import { z } from 'zod';

export const LambdaConfigSchema = CommonConfigSchema.extend({
  log: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  }),
});

export type LambdaConfig = z.infer<typeof LambdaConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): LambdaConfig {
  return LambdaConfigSchema.parse({
    ...commonConfigFromEnv(env),
    log: { level: env.LOG_LEVEL ?? 'info' },
  });
}
