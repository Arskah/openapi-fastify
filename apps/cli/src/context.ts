import { createApi, type Api } from '@demo/api-client';
import type { CommandContext } from '@stricli/core';

export interface CliContext extends CommandContext {
  readonly process: NodeJS.Process;
}

/** Flags every API command accepts. Stricli has no global flags, so commands spread these into their own. */
export interface ApiFlags {
  readonly apiUrl: string;
  readonly requestId?: string;
  readonly verbose: boolean;
}

export const apiFlags = {
  apiUrl: {
    kind: 'parsed',
    parse: String,
    brief: 'API base URL (env: API_URL)',
    placeholder: 'url',
    default: process.env.API_URL ?? 'http://localhost:3000',
  },
  requestId: {
    kind: 'parsed',
    parse: String,
    brief: 'Request ID to send (env: REQUEST_ID, default: random UUID)',
    placeholder: 'id',
    optional: true,
  },
  verbose: { kind: 'boolean', brief: 'Log requests to stderr', default: false },
} as const;

export const apiAliases = { v: 'verbose' } as const;

export function apiFrom({ apiUrl, requestId = process.env.REQUEST_ID, verbose }: ApiFlags): Api {
  return createApi({ apiUrl, requestId, verbose });
}
