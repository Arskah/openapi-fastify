// Invokes the handler locally with a fake SQS batch: one message per title argument.
//   pnpm --filter @demo/lambda invoke "Buy milk" "Walk dog"
import { randomUUID } from 'node:crypto';
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../src/handler.ts';

const titles = process.argv.slice(2);
if (titles.length === 0) {
  console.error('usage: invoke <title>...');
  process.exit(1);
}

const event: SQSEvent = {
  Records: titles.map((title) => ({ messageId: randomUUID(), body: JSON.stringify({ title }) }) as SQSRecord),
};
const context = { awsRequestId: randomUUID() } as Context;

console.log(await handler(event, context, () => {}));
