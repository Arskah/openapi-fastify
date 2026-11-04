import { z } from 'zod';

/**
 * Configuration needed by common code. Apps extend this with their own sections
 * (see `apps/server/src/config.ts`) and pass the whole object to `createContainer`.
 */
export const CommonConfigSchema = z.object({
  aws: z.object({
    region: z.string().min(1),
    /** Override for local development, e.g. DynamoDB Local. */
    dynamoEndpoint: z.url().optional(),
  }),
  tables: z.object({
    todos: z.string().min(1),
  }),
});

export type CommonConfig = z.infer<typeof CommonConfigSchema>;

type Env = Record<string, string | undefined>;

/** Raw (unvalidated) common config from environment variables. */
export function commonConfigFromEnv(env: Env) {
  return {
    aws: {
      region: env.AWS_REGION ?? 'eu-north-1',
      dynamoEndpoint: env.DYNAMODB_ENDPOINT || undefined,
    },
    tables: {
      todos: env.TODOS_TABLE ?? 'todos',
    },
  };
}

export function loadCommonConfig(env: Env = process.env): CommonConfig {
  return CommonConfigSchema.parse(commonConfigFromEnv(env));
}
