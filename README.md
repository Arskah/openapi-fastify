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

## Adding a feature

`features/projects` is the reference for a feature that builds on another one.
`projectService.addTodo` creates a todo and attaches it to the project in one DynamoDB transaction:

```ts
const todo = await transact(async (tx) => {
  const todo = await todoService.create(input, { tx }); // todos' rules, write deferred
  tx.write(projectRepository.appendTodoOp(projectId, todo.id, now), {
    onConditionFailed: () => new NotFoundError('Project', projectId),
  });
  return todo;
});
```

The layers split the work this way:

- **Repositories own tables.** They return `WriteOp`s (key, condition, update expression) and
  do reads. Only the todos repository knows how a todo is stored.
- **Services own rules** (ids, defaults, timestamps, not-found semantics, post-commit side
  effects). Write methods take an optional `{ tx }`: without it they write immediately, and with
  it they queue the write and defer side effects with `tx.afterCommit`.
- **Other features call services, not repositories.** The transaction runner (`db/transaction.ts`)
  commits every queued op in one call and maps a failed condition to the error its owner chose.

Checklist, using `projects` as the example:

1. `packages/common/src/features/projects/`: `*.schema.ts`, `*.repository.ts`, `*.service.ts`,
   `*.table.ts`, and `index.ts` exporting `projectsModule(deps)`
2. `config.ts`: table name (`tables.projects` / `PROJECTS_TABLE`)
3. `tables.ts`: add the table definition (`pnpm db:init` creates every listed table)
4. `container.ts`: add the module to `buildServices`. Composing it before a module it needs
   (here `todosModule`) is a type error.
5. `index.ts`: re-export the feature
6. `apps/server/src/routes/projects.ts`: register it in `app.ts`, then run `pnpm generate`
7. `apps/cli/src/commands/projects.ts`: add it in `main.ts`

## Dependency policy

`pnpm-workspace.yaml` pins exact versions (`savePrefix: ''`) and refuses releases younger
than 3 days (`minimumReleaseAge: 4320`).

`pnpm typecheck` runs TypeScript 7. `@hey-api/openapi-ts` still needs the TypeScript 6
compiler API, so `apps/cli` pins `typescript@6.0.3` as a devDependency only to satisfy that peer.
