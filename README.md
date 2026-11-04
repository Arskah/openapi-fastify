# openapi-fastify

Demo monorepo: Fastify API with an OpenAPI spec generated from Zod schemas, a typed CLI
generated from that spec, and business logic in a shared package wired through a type-safe
dependency container.

```
packages/common   business logic, no HTTP: domain/, data/ (DynamoDB), features/ (use cases), container
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
pnpm -s cli projects create Garden -t "Mow lawn" "Plant tulips"
pnpm check              # typecheck + layering rules (dependency-cruiser)
```

`pnpm dev` is `db:up` → `db:init` (waits for DynamoDB) → `dev:server`; run the steps
individually if you prefer. All TypeScript runs directly on Node (type stripping), so there is no build step.

## How it fits together

**Schemas → OpenAPI → client.** Zod schemas in `packages/common/src/domain/` (entities) and
`features/*/…schema.ts` (use-case inputs and views) validate requests in Fastify and become OpenAPI components via `.meta({ id })`. After changing
schemas or routes, run:

```sh
pnpm generate   # writes apps/server/openapi.json, then regenerates apps/cli/src/client
```

**Container.** `createContainer({ config, logger })` in `packages/common/src/container.ts` builds
everything once per process (DynamoDB client, repositories, services) and composes modules
bottom-up with `extend()`. Each module is a function `(deps) => provides`. Its parameter type is
checked against what earlier modules provide, so wiring things in the wrong order fails at
compile time:

```ts
function buildServices<C extends CommonConfig>(core: Core<C>) {
  const data = extend(core, repositoriesModule);
  return extend(extend(data, todosModule), projectsModule);
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

## Layers

```
packages/common/src/
  domain/            todo.ts, project.ts: entity schemas, branded types, rules (createTodo, createProject)
  data/
    tables/          storage format per table: definition, key, item mapping, write ops (no I/O)
    transaction.ts   transactWrite(): one TransactWriteItems call, failed condition → owner's error
    *.repository.ts  I/O, one per aggregate
  features/          use cases; each mixes whatever domain objects and repositories it needs
  container.ts       core → repositories → features
```

Imports only point down (`features → data → domain`), and `pnpm lint:deps` (dependency-cruiser,
`.dependency-cruiser.cjs`) enforces it:

| Rule | Why |
|---|---|
| `features-independent` | See below |
| `repositories-independent` | `ProjectRepository` writes todos, but through `tables/todos.ts`, not `TodoRepository`. If repositories used each other, deleting a todo that must clean up its project would create a cycle. |
| `tables-without-io` | Table modules can be shared by any repository because they only describe storage. |
| `domain-is-innermost`, `data-below-features`, `no-circular` | Keep the direction one-way. |

**Why features must not import features.** "Create project with todos" could call the todos
feature's `create`, but:

- **Atomicity is lost.** A use case runs its own writes, so a caller cannot put them into its
  transaction without the `{ tx }` double mode on every method (see commit `d79005d`).
- **Cycles show up quickly.** Projects needs todos for creation, and todos needs projects to clean
  up `todoIds` on delete. The container cannot express a cycle, and ESM import cycles fail at
  runtime with "Cannot access X before initialization".
- **Side effects get tangled.** The callee logs, emits events or enforces permissions for its
  own use case, and those run inside someone else's flow, sometimes before the caller's commit.
- **Use cases get coupled to each other.** Changing the todos API's behaviour silently changes
  projects. Domain rules (`createTodo`) are the stable thing to share, so they live in `domain/`.

**Branded entities.** `Todo` and `Project` are Zod-branded. Only `createTodo` / `createProject`
or parsing (repositories parse stored items) produce them, so a repository cannot be handed an
object literal that skipped the rules. `TodoPatch` works the same way, via `todoPatch()`.

**Aggregate repositories.** `ProjectRepository` deliberately writes the todos table:
`create(project, todos)` and `addTodo(projectId, todo)` are single transactions across both tables.
This couples their storage on purpose, which is normal for DynamoDB. Keep these methods at the
aggregate level (save a project with its todos), not one per use case, or the repository turns
into a service layer. Transactions hold at most 100 writes, hence `MAX_INITIAL_TODOS = 50`.

Known gap: deleting a todo leaves its id in `project.todoIds` (reads skip missing todos). Fixing
it needs a `todo.projectId` back-reference and a delete that updates both tables, which is a job
for the repository that owns the project aggregate.

## Adding a feature

1. Entities and rules → `domain/` (if new)
2. Storage → `data/tables/<name>.ts` + `tables/index.ts`, table name in `config.ts`, repository in
   `data/` + `repositoriesModule`
3. Use cases → `features/<name>/` with `index.ts` exporting `<name>Module(deps)`, added in
   `container.ts`
4. Re-export from `src/index.ts`. Add routes in `apps/server/src/routes/` and register them in
   `app.ts`, then run `pnpm generate` and add a CLI command
5. `pnpm check`

## Dependency policy

`pnpm-workspace.yaml` pins exact versions (`savePrefix: ''`) and refuses releases younger
than 3 days (`minimumReleaseAge: 4320`).

`pnpm typecheck` runs TypeScript 7. `@hey-api/openapi-ts` still needs the TypeScript 6
compiler API, so `apps/cli` pins `typescript@6.0.3` as a devDependency only to satisfy that peer.
dependency-cruiser has the same limit (`typescript <7`), so a `packageExtensions` entry gives it its
own `typescript@6.0.3`.
