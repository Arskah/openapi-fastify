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

export class ApiRequestError extends Error {
  readonly status: number;
  readonly requestId: string;

  constructor(status: number, body: Partial<ApiError> | undefined, requestId: string) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.requestId = body?.requestId ?? requestId;
  }
}

/** Resolves to the response data or throws an `ApiRequestError`. */
export async function unwrap<T>(
  api: Api,
  result: Promise<{ data?: T; error?: unknown; response?: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (error !== undefined || !response?.ok) {
    throw new ApiRequestError(response?.status ?? 0, error as Partial<ApiError> | undefined, api.requestId);
  }
  return data as T;
}
