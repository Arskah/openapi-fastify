import { FLAG_DEFAULTS, type FeatureFlagProvider, type FlagValues, type Gate } from '../../ports/feature-flags.ts';

export interface StaticFlags {
  gates?: Partial<Record<Gate, boolean>>;
  values?: Partial<FlagValues>;
}

/**
 * Fixed flags, the same for every subject: gates off and default values unless
 * overridden. For tests and for running without a Statsig key.
 */
export function staticFeatureFlags({ gates = {}, values = {} }: StaticFlags = {}): FeatureFlagProvider {
  return {
    isEnabled: (gate) => gates[gate] ?? false,
    value: (key) => values[key] ?? FLAG_DEFAULTS[key],
    flush: async () => {},
    shutdown: async () => {},
  };
}
