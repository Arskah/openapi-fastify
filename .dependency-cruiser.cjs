// Layering rules for packages/common:
//   domain ← ports ← integrations (adapters) ← container ← features (use cases)
// Use cases depend on ports, never on an integration.
const src = '^packages/common/src';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-innermost',
      comment: 'Domain types and rules must not know about storage, use cases or wiring.',
      severity: 'error',
      from: { path: `${src}/domain/` },
      to: { path: `${src}/(ports|integrations|features|container|context)` },
    },
    {
      name: 'ports-are-abstract',
      comment: 'ports/ holds interfaces only: no integration, wiring or use case behind them.',
      severity: 'error',
      from: { path: `${src}/ports/` },
      to: { path: `${src}/(integrations|features|container)` },
    },
    {
      name: 'features-use-ports',
      comment:
        'Use cases depend on ports/, never on an integration. Storage ops, clients and tables stay behind the port, so a use case cannot stage raw writes.',
      severity: 'error',
      from: { path: `${src}/features/` },
      to: { path: `${src}/integrations/` },
    },
    {
      name: 'features-without-container',
      comment:
        'Use cases declare the ports they need ({ todoRepository: TodoRepository }), not keys of the container. Seeing the Container type would let a use case ask for the DynamoDB client.',
      severity: 'error',
      from: { path: `${src}/features/` },
      to: { path: `${src}/(container|feature-flags)\\.ts$` },
    },
    {
      name: 'integrations-independent',
      comment: 'Each integration (dynamo/, http/, …) stands alone; the container combines them.',
      severity: 'error',
      from: { path: `${src}/integrations/([^/]+)/` },
      to: { path: `${src}/integrations/`, pathNot: `${src}/integrations/$1/` },
    },
    {
      name: 'integrations-below-container',
      comment: 'Integrations are wired by the container (and feature-flags.ts); they must not depend on it.',
      severity: 'error',
      from: { path: `${src}/integrations/` },
      to: { path: `${src}/(container|feature-flags)\\.ts$` },
    },
    {
      name: 'repositories-independent',
      comment:
        'Repository implementations must not use each other (a cycle is one feature away). Share storage details through tables/ instead.',
      severity: 'error',
      from: { path: `${src}/integrations/.+\\.repository\\.ts$` },
      to: { path: `${src}/integrations/.+\\.repository\\.ts$` },
    },
    {
      name: 'tables-without-io',
      comment: 'Table modules describe storage (keys, mapping, write ops); repositories do the I/O.',
      severity: 'error',
      from: { path: `${src}/integrations/dynamo/tables/` },
      to: {
        path: `(${src}/integrations/dynamo/(client|[^/]+\\.repository)\\.ts$|@aws-sdk/lib-dynamodb)`,
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'vendor-sdks-in-their-integration',
      comment:
        'Only integrations/statsig/ sees the Statsig SDK. Use cases check flags through the FeatureFlags port, already bound to a subject, so they never handle a StatsigUser.',
      severity: 'error',
      from: { pathNot: `${src}/integrations/statsig/` },
      to: { path: '@statsig/' },
    },
    {
      name: 'no-cross-feature-barrels',
      comment:
        "Use cases import other features' use-case files directly. Barrels pull in a whole feature and turn file-level DAGs into feature-level cycles.",
      severity: 'error',
      from: { path: `${src}/features/([^/]+)/` },
      to: { path: `${src}/features/[^/]+/index\\.ts$`, pathNot: `${src}/features/$1/` },
    },
    {
      name: 'container-is-infrastructure',
      comment: 'The container, flag provider wiring, ports and integrations never import use cases.',
      severity: 'error',
      from: { path: `${src}/(container|feature-flags|ports/|integrations/)` },
      to: { path: `${src}/features/` },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Report type-only imports too, so `import type` cannot sneak around the layering
    tsPreCompilationDeps: true,
  },
};
