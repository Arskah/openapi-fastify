import { createTodo, CreateTodoInputSchema } from '@demo/common';
import { sqsHandler } from '../sqs.ts';

/** SQS consumer: each message body is a `CreateTodoInput` as JSON. */
export const handler = sqsHandler(CreateTodoInputSchema, async (input, { container }) => {
  await createTodo(container, input);
});
