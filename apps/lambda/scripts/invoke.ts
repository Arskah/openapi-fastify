// Invokes the createTodos handler locally with a fake SQS batch: one message per title argument.
//   pnpm lambda:invoke "Buy milk" "Walk dog"
import { randomUUID } from 'node:crypto';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../src/handlers/createTodos.ts';

const titles = process.argv.slice(2);
if (titles.length === 0) {
  console.error('usage: invoke <title>...');
  process.exit(1);
}

const event: SQSEvent = {
  Records: titles.map(
    (title) =>
      ({
        messageId: randomUUID(),
        body: JSON.stringify({ title }),
        attributes: { ApproximateReceiveCount: '1' },
        eventSourceARN: 'arn:aws:sqs:eu-north-1:123456789012:demo-todos',
      }) as SQSRecord,
  ),
};

const functionName = 'demo-create-todos';
const context = {
  awsRequestId: randomUUID(),
  functionName,
  functionVersion: '$LATEST',
  invokedFunctionArn: `arn:aws:lambda:eu-north-1:123456789012:function:${functionName}`,
  memoryLimitInMB: '256',
  getRemainingTimeInMillis: () => 30_000,
} as Context;

console.log(await handler(event, context, () => {}));
