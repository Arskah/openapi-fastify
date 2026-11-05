import { AppError, runWithContext } from '@demo/common';
import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { z } from 'zod';
import { lambdaHandler, type Invocation } from './lambda.ts';

export interface MessageInvocation extends Invocation {
  record: SQSRecord;
}

export type SqsMessageHandler<T> = (message: T, invocation: MessageInvocation) => Promise<void>;

/** `arn:aws:sqs:<region>:<account>:<queue>` */
function queueName(eventSourceArn: string): string | undefined {
  return eventSourceArn.split(':')[5];
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/**
 * SQS consumer on top of `lambdaHandler`: `handle` is called once per record
 * with its body parsed by `schema`.
 *
 * Each record runs in its own context whose logger adds `sqs: { messageId,
 * queue, receiveCount }` to the invocation's AWS bindings, so common code logs
 * which message it was working on. Malformed bodies and `AppError`s are logged
 * and dropped (a retry would fail the same way); any other failure is reported
 * in `batchItemFailures` so SQS redelivers only that record. On a FIFO queue
 * the records after a failure are reported too, to keep their order.
 */
export function sqsHandler<S extends z.ZodType>(schema: S, handle: SqsMessageHandler<z.output<S>>) {
  return lambdaHandler<SQSEvent, SQSBatchResponse>(async (event, invocation) => {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
      if (batchItemFailures.length > 0 && record.eventSourceARN.endsWith('.fifo')) {
        batchItemFailures.push({ itemIdentifier: record.messageId });
        continue;
      }

      const logger = invocation.logger.child({
        sqs: {
          messageId: record.messageId,
          queue: queueName(record.eventSourceARN),
          receiveCount: Number(record.attributes.ApproximateReceiveCount),
        },
      });

      await runWithContext({ logger }, async () => {
        const message = schema.safeParse(parseJson(record.body));
        if (!message.success) {
          logger.error({ issues: z.flattenError(message.error) }, 'dropping malformed message');
          return;
        }
        try {
          await handle(message.data, { ...invocation, logger, record });
        } catch (err) {
          if (err instanceof AppError) {
            logger.error({ err }, 'dropping rejected message');
            return;
          }
          logger.error({ err }, 'failed to process message');
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      });
    }

    return { batchItemFailures };
  });
}
