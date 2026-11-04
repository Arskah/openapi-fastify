# openapi-fastify

Demo monorepo: Fastify API with an OpenAPI spec generated from Zod schemas, a typed CLI
generated from that spec, and business logic in a shared package wired through a type-safe
dependency container.

```
packages/common   business logic, no HTTP: config, Logger contract, container, DynamoDB, features/
apps/server       Fastify 5 + fastify-type-provider-zod + @fastify/swagger, pino with request IDs
apps/cli          commander CLI over a @hey-api/openapi-ts client generated from apps/server/openapi.json
```

## Getting started

```sh
mise install            # node + pnpm versions from mise.toml
pnpm install
cp .env.example .env
pnpm dev                # DynamoDB Local on :8000 + todos table + API on :3000 (watch), Swagger UI on /docs

pnpm -s cli todos add "Buy milk"
pnpm -s cli todos list
pnpm -s cli -v --request-id my-trace todos update <id> --done
```

`pnpm dev` is `db:up` → `db:init` (waits for DynamoDB) → `dev:server`; run the steps
individually if you prefer. All TypeScript runs directly on Node (type stripping), so there is no build step.

## How it fits together

**Schemas → OpenAPI → client.** Zod schemas in `packages/common/src/features/*/…schema.ts`
validate requests in Fastify and become OpenAPI components via `.meta({ id })`. After changing
schemas or routes, run:

```sh
pnpm generate   # writes apps/server/openapi.json, then regenerates apps/cli/src/client
```

**Container.** `createContainer({ config, logger })` in `packages/common/src/container.ts` builds
everything once per process (DynamoDB client, repositories, services) and composes feature
modules with `extend()`. Each module is a function `(deps) => provides`. Its parameter type is
checked against what earlier modules provide, so wiring things in the wrong order fails at
compile time. To add a feature:

```ts
function buildServices<C extends CommonConfig>(core: Core<C>) {
  return extend(extend(core, todosModule), notesModule);
}
```

**Request-scoped logging.** The server derives a request ID from the `x-request-id` header,
or generates a UUID, and echoes it back. Its `onRequest` hook continues the request inside
`runWithContext({ logger: request.log }, …)` (AsyncLocalStorage, `packages/common/src/context.ts`).
Services hold a context logger that writes through the current context's logger. Every log line
from common code therefore carries `requestId`, even though the services are singletons. Outside a
context (startup, scripts), it falls back to the root logger. Other entry points, such as a queue
worker, can call `runWithContext` the same way. The CLI sends a fresh UUID (or `--request-id`) and
prints it on errors, so you can grep the server logs for it.

**Config.** `CommonConfigSchema` covers what common needs (AWS, tables). The server extends it
with its own sections (`ServerConfigSchema`) and passes the whole object into the container,
whose type parameter keeps the extended config typed on `container.config`.

## Dependency policy

`pnpm-workspace.yaml` pins exact versions (`savePrefix: ''`) and refuses releases younger
than 3 days (`minimumReleaseAge: 4320`).

`pnpm typecheck` runs TypeScript 7. `@hey-api/openapi-ts` still needs the TypeScript 6
compiler API, so `apps/cli` pins `typescript@6.0.3` as a devDependency only to satisfy that peer.
