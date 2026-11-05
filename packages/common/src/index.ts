// Public API of @demo/common: what apps need to configure it, wire it, call use cases and expose their
// schemas. Internals (domain rules, repository ports, the DynamoDB integration, useCase/useTransaction) are not
// exported, so apps cannot bypass the use cases.

// Configuration and wiring
export { CommonConfigSchema, commonConfigFromEnv, loadCommonConfig, type CommonConfig } from './config.ts';
export { createContainer, type Container, type ContainerOptions } from './container.ts';
export { featureFlagsFromEnv, startFeatureFlags, type FeatureFlagsOptions } from './feature-flags.ts';
export { localSecretStore } from './integrations/local-secrets/index.ts';
export { staticFeatureFlags, type StaticFlags } from './integrations/static-flags/index.ts';
export type { FeatureFlagProvider, FeatureFlags, FlagSubject, FlagValues, Gate } from './ports/feature-flags.ts';
export type { SecretStore } from './ports/secrets.ts';
export { runWithContext, type RequestContext } from './context.ts';
export type { Logger, LogFn } from './logger.ts';

// Errors apps map to responses
export { AppError, ConflictError, NotFoundError, ValidationError } from './errors.ts';

// Entities and inputs, as schemas (validation, OpenAPI) and types
export { ProjectIdSchema, TodoIdSchema } from './domain/ids.ts';
export { ProjectSchema, type Project } from './domain/project.ts';
export {
  CreateTodoInputSchema,
  TodoSchema,
  UpdateTodoInputSchema,
  type CreateTodoInput,
  type Todo,
  type UpdateTodoInput,
} from './domain/todo.ts';

// Use cases
export * from './features/projects/index.ts';
export * from './features/todos/index.ts';
