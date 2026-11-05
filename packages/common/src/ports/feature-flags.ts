/**
 * Gates common code checks. A gate that is off, unknown to the provider or not
 * evaluated (provider down) keeps the old behaviour, so `false` is always safe.
 */
export type Gate = 'enforce_project_todo_limit';

/** Tunables common code reads. */
export interface FlagValues {
  maxTodosPerProject: number;
}

/** Used when the provider has no value, or one of the wrong type. */
export const FLAG_DEFAULTS: FlagValues = {
  maxTodosPerProject: 50,
};

/** Who a flag is evaluated for, when the call site has one (e.g. a user ID from the use case's input). */
export interface FlagSubject {
  userId: string;
}

/**
 * Feature flags. The call site decides whether a check is per subject (pass
 * one) or global (omit it). Every call evaluates against the provider's
 * current rules, so values change at runtime. Evaluation is synchronous and
 * local: the provider keeps its rules up to date in the background, so
 * checking a flag does no I/O and cannot fail, even inside a transaction.
 * Read a flag once per decision: two calls may see different rules.
 */
export interface FeatureFlags {
  isEnabled(gate: Gate, subject?: FlagSubject): boolean;
  value<K extends keyof FlagValues>(key: K, subject?: FlagSubject): FlagValues[K];
}

/** Process-wide flag provider, started by the app before it serves anything. */
export interface FeatureFlagProvider extends FeatureFlags {
  /** Sends queued exposure events. Lambda calls this per invocation: a frozen sandbox sends nothing. */
  flush(): Promise<void>;
  /** Flushes and stops background sync. */
  shutdown(): Promise<void>;
}
