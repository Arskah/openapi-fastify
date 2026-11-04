import { AppError, ConflictError, NotFoundError } from '@demo/common';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const ErrorResponseSchema = z
  .object({
    statusCode: z.number().int(),
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  })
  .meta({ id: 'ApiError' });

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

function statusFor(error: AppError): number {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  return 400;
}

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  const send = (statusCode: number, code: string, message: string) =>
    reply.code(statusCode).send({ statusCode, code, message, requestId: request.id } satisfies ErrorResponse);

  if (hasZodFastifySchemaValidationErrors(error)) {
    return send(400, 'VALIDATION_ERROR', error.message);
  }
  if (error instanceof AppError) {
    return send(statusFor(error), error.code, error.message);
  }
  if (error.statusCode && error.statusCode < 500) {
    return send(error.statusCode, error.code ?? 'BAD_REQUEST', error.message);
  }

  request.log.error({ err: error }, 'unhandled error');
  return send(500, 'INTERNAL_ERROR', 'Internal server error');
}
