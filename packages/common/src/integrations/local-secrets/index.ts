import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { SecretStore } from '../../ports/secrets.ts';

const SecretsFileSchema = z.record(z.string(), z.string());

/**
 * Secrets from a local JSON file of `{ "<secret id>": "<value>" }`, standing
 * in for AWS Secrets Manager in the demo: same IDs, same async shape. The file
 * is read on each `get()`, as each Secrets Manager call would be. Without a
 * file (or a path), every secret is missing.
 */
export function localSecretStore(file: string | undefined): SecretStore {
  return {
    async get(id) {
      if (!file) return undefined;
      let text: string;
      try {
        text = await readFile(file, 'utf8');
      } catch (err) {
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return undefined;
        throw err;
      }
      return SecretsFileSchema.parse(parseJson(text, file))[id];
    },
  };
}

/** `JSON.parse` errors can quote the input, which here is secrets; report the file only. */
function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Secrets file ${file} is not valid JSON`);
  }
}
