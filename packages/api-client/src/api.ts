import { randomUUID } from 'node:crypto';
import { createClient, type Client } from './client/client/index.ts';
import type { ApiError } from './client/types.gen.ts';

export interface ApiOptions {
  apiUrl: string;
  requestId?: string;
  verbose?: boolean;
}

export interface Api {
  client: Client;
  requestId: string;
}

/** Fetch client that tags every request with an `x-request-id` the server logs under. */
export function createApi({ apiUrl, requestId = randomUUID(), verbose }: ApiOptions): Api {
  const client = createClient({
    baseUrl: apiUrl,
    headers: { 'x-request-id': requestId },
  });

  if (verbose) {
    client.interceptors.response.use((response, request) => {
      console.error(`${request.method} ${request.url} -> ${response.status} (request ${requestId})`);
      return response;
    });
  }

  return { client, requestId };
}

/** A request that failed or never got a response; `status` is 0 when the API could not be reached. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly requestId: string;

  constructor(message: string, status: number, requestId: string, options?: ErrorOptions) {
    super(`${message} (request ${requestId})`, options);
    this.name = 'ApiRequestError';
    this.status = status;
    this.requestId = requestId;
  }
}

/** Short reason for a network failure, e.g. `ECONNREFUSED` from undici's `fetch failed`. */
function networkReason(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') return cause.code;
  if (cause instanceof Error) return cause.message;
  return error instanceof Error ? error.message : String(error);
}

/** Resolves to the response data or throws an `ApiRequestError`. */
export async function unwrap<T>(
  api: Api,
  result: Promise<{ data?: T; error?: unknown; request?: Request; response?: Response }>,
): Promise<T> {
  const { data, error, request, response } = await result;
  if (!response) {
    const origin = request ? new URL(request.url).origin : 'the API';
    throw new ApiRequestError(`Could not reach ${origin}: ${networkReason(error)}`, 0, api.requestId, {
      cause: error,
    });
  }
  if (error !== undefined || !response.ok) {
    const message = stringField(error, 'message') ?? `Request failed with status ${response.status}`;
    throw new ApiRequestError(
      `Error ${response.status}: ${message}`,
      response.status,
      stringField(error, 'requestId') ?? api.requestId,
    );
  }
  // The client sets data on every successful response ({} for an empty body)
  if (data === undefined) throw new ApiRequestError('Empty response', response.status, api.requestId);
  return data;
}

/** `body[key]` if the error body is an object with that string field (e.g. our `ApiError`). */
function stringField(body: unknown, key: keyof ApiError): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value: unknown = Reflect.get(body, key);
  return typeof value === 'string' ? value : undefined;
}
