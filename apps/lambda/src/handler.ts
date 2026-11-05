import { AppError, createContainer, createTodo, CreateTodoInputSchema, runWithContext } from '@demo/common';
import type { SQSBatchItemFailure, SQSHandler } from 'aws-lambda';
import { pino } from 'pino';
import { z } from 'zod';
import { loadConfig } from './config.ts';

// Module scope: built once per cold start and reused by warm invocations
const config = loadConfig();
const logger = pino({ level: config.log.level });
const container = createContainer({ config, logger });

/**
 * SQS consumer: each message body is a `CreateTodoInput` as JSON.
 *
 * Every record runs in its own context, so log lines from common code carry
 * the Lambda request ID and the SQS message ID. Malformed messages and
 * business-rule errors are logged and dropped (a retry would fail the same
 * way); any other failure is reported back so SQS redelivers only that record.
 */
export const handler: SQSHandler = async (event, context) => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    const log = logger.child({ requestId: context.awsRequestId, messageId: record.messageId });

    await runWithContext({ logger: log }, async () => {
      const input = CreateTodoInputSchema.safeParse(parseJson(record.body));
      if (!input.success) {
        log.error({ issues: z.flattenError(input.error) }, 'dropping malformed message');
        return;
      }
      try {
        await createTodo(container, input.data);
      } catch (err) {
        if (err instanceof AppError) {
          log.error({ err }, 'dropping rejected message');
          return;
        }
        log.error({ err }, 'failed to process message');
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    });
  }

  return { batchItemFailures };
};

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
