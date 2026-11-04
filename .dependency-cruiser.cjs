// Layering rules for packages/common: domain ← data ← container ← features (use cases).
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
      name: 'data-below-container',
      comment: 'The data layer is wired by the container; it must not depend on it.',
      severity: 'error',
      from: { path: `${src}/data/` },
      to: { path: `${src}/container` },
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
      name: 'no-cross-feature-barrels',
      comment:
        'Use cases import other features\' use-case files directly. Barrels pull in a whole feature and turn file-level DAGs into feature-level cycles.',
      severity: 'error',
      from: { path: `${src}/features/([^/]+)/` },
      to: { path: `${src}/features/[^/]+/index\\.ts$`, pathNot: `${src}/features/$1/` },
    },
    {
      name: 'container-is-infrastructure',
      comment: 'The container wires infrastructure only; use cases are plain functions that receive it.',
      severity: 'error',
      from: { path: `${src}/(container|data/)` },
      to: { path: `${src}/features/` },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Report type-only imports too, so `import type` cannot sneak around the layering
    tsPreCompilationDeps: true,
  },
};
