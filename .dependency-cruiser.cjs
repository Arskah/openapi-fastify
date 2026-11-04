// Layering rules for packages/common: domain ← data ← features ← container.
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
      to: { path: `${src}/(data|features|container|context)` },
    },
    {
      name: 'data-below-features',
      comment: 'The data layer serves features; it must not depend on them.',
      severity: 'error',
      from: { path: `${src}/data/` },
      to: { path: `${src}/(features|container)` },
    },
    {
      name: 'repositories-independent',
      comment:
        'Repositories must not use each other (a cycle is one feature away). Share storage details through data/tables/ instead.',
      severity: 'error',
      from: { path: `${src}/data/[^/]+\\.repository\\.ts$` },
      to: { path: `${src}/data/[^/]+\\.repository\\.ts$` },
    },
    {
      name: 'tables-without-io',
      comment: 'Table modules describe storage (keys, mapping, write ops); repositories do the I/O.',
      severity: 'error',
      from: { path: `${src}/data/tables/` },
      to: { path: `(${src}/data/(dynamo|[^/]+\\.repository)\\.ts$|@aws-sdk/lib-dynamodb)`, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'features-independent',
      comment:
        'Features must not import other features. Move shared rules to domain/ and shared persistence to data/.',
      severity: 'error',
      from: { path: `${src}/features/([^/]+)/` },
      to: { path: `${src}/features/`, pathNot: `${src}/features/$1/` },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Report type-only imports too, so `import type` cannot sneak around the layering
    tsPreCompilationDeps: true,
  },
};
