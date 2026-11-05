/**
 * Where startup code fetches secrets, e.g. AWS Secrets Manager (`GetSecretValue`
 * by secret ID). Async: a secret is fetched over the network at startup.
 *
 * Only startup code (`startFeatureFlags`, ...) uses this, and hands each secret
 * to the integration that needs it. Use cases never see a secret, so they
 * cannot depend on this port (see `.dependency-cruiser.cjs`).
 */
export interface SecretStore {
  /** The secret's value, or `undefined` if no secret has this ID. Rejects if the store is unreachable. */
  get(id: string): Promise<string | undefined>;
}
