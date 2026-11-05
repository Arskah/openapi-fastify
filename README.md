# openapi-fastify

Demo monorepo: Fastify API with an OpenAPI spec generated from Zod schemas, a typed API client
generated from that spec, and business logic in a shared package wired through a type-safe
dependency container. The server and an SQS Lambda both consume that package.

```
packages/common      business logic, no HTTP: domain/, data/ (DynamoDB), features/ (use cases), container
packages/api-client  @hey-api/openapi-ts fetch client generated from apps/server/openapi.json, request-ID helpers
apps/server          Fastify 5 + fastify-type-provider-zod + @fastify/swagger, pino with request IDs
apps/cli             Stricli CLI over @demo/api-client
apps/lambda          SQS-triggered Lambda that creates todos through @demo/common
```

## Getting started

```sh
mise install            # node + pnpm versions from mise.toml
pnpm install
cp .env.example .env
pnpm dev                # DynamoDB Local on :8000 + todos table + API on :3000 (watch), Swagger UI on /docs

pnpm -s cli todos add "Buy milk"
pnpm -s cli todos list
pnpm -s cli todos update <id> --done -v --request-id my-trace
pnpm -s cli projects create Garden -t "Mow lawn" -t "Plant tulips"
pnpm lambda:invoke "Water plants"   # runs the Lambda handler locally with a fake SQS batch
pnpm check              # typecheck + layering rules (dependency-cruiser)
```

`pnpm dev` is `db:up` → `db:init` (waits for DynamoDB) → `dev:server`; run the steps
individually if you prefer. All TypeScript runs directly on Node (type stripping), so there is no build step.

## How it fits together

**Schemas → OpenAPI → client.** Zod schemas in `packages/common/src/domain/` (entities) and
`features/*/…schema.ts` (use-case inputs and views) validate requests in Fastify and become OpenAPI components via `.meta({ id })`. After changing
schemas or routes, run:

```sh
pnpm generate   # writes apps/server/openapi.json, then regenerates packages/api-client/src/client
```

**Container.** `createContainer({ config, logger })` in `packages/common/src/container.ts` builds
the process-wide infrastructure once: config, context logger, DynamoDB client, repositories and the
unit of work. Use cases are not in it (see [Use cases](#use-cases)). Modules compose with
`extend()`, and each module's parameter type is checked against what is already provided.

**Request-scoped logging.** The server derives a request ID from the `x-request-id` header,
or generates a UUID, and echoes it back. Its `onRequest` hook continues the request inside
`runWithContext({ logger: request.log }, …)` (AsyncLocalStorage, `packages/common/src/context.ts`).
Repositories and use cases log through a context logger that writes through the current context's
logger. Every log line from common code therefore carries `requestId`, even though the
repositories are singletons. Outside a
context (startup, scripts), it falls back to the root logger. Other entry points, such as a queue
worker, call `runWithContext` the same way, as `apps/lambda` does (see Lambda below). The CLI
sends a fresh UUID (or `--request-id`) and
prints it on errors, so you can grep the server logs for it.

**CLI.** Stricli has no global flags, so every API command spreads `apiFlags` (`--api-url`,
`--request-id`, `-v`) from `apps/cli/src/context.ts` into its own flags. They go after the
subcommand: `demo todos list -v`. Commands run their API calls through `withApi(flags, …)`, which
returns `ApiRequestError`s to Stricli so it prints just the message, e.g.
`Could not reach http://localhost:3000: ECONNREFUSED (request …)`.

**Lambda.** Every handler in `apps/lambda` is wrapped with `lambdaHandler()` (`src/lambda.ts`).
On the first invocation in a sandbox it builds config, the Lambda's own pino logger (`src/logger.ts`)
and the container, and reuses them while the sandbox stays warm. Each invocation runs inside
`runWithContext` with a child logger bound to `requestId` (the Lambda request ID) and
`aws: { accountId, region, functionName, functionVersion, traceId }`, with the account and region
taken from `invokedFunctionArn`. Common code logs through the container's context logger, so every
line it writes carries those AWS fields without knowing it runs in Lambda. The wrapper also
logs invocation start (with `coldStart`), duration and failures. A handler gets
`{ container, logger, context }`.

`sqsHandler(schema, handle)` (`src/sqs.ts`) builds on it for SQS: it parses each record's body with
`schema` and runs `handle` per record in a nested context that adds
`sqs: { messageId, queue, receiveCount }`, so common's log lines also say which message they belong
to. Malformed bodies and `AppError`s are logged and dropped; other failures go to
`batchItemFailures` so SQS retries only those records (on a FIFO queue, also every record after the
first failure). A consumer is then just the use-case call:

```ts
// handlers/createTodos.ts
export const handler = sqsHandler(CreateTodoInputSchema, async (input, { container }) => {
  await createTodo(container, input);
});
```

**Config.** `CommonConfigSchema` covers what common needs (AWS, tables). Each app extends it
with its own sections (`ServerConfigSchema`, `LambdaConfigSchema`) and passes the whole object into the container,
whose type parameter keeps the extended config typed on `container.config`.

## Layers

```
packages/common/src/
  domain/            ids.ts, todo.ts, project.ts: branded entities + rules (newTodo, applyTodoUpdate, newProject, withTodos)
  data/
    tables/          storage format per table: definition, key, item mapping, write ops (no I/O)
    unit-of-work.ts  stages writes; commits them in one TransactWriteItems at the outermost use case
    transaction.ts   commitWrites(): failed condition → the error chosen by whoever staged the write
    *.repository.ts  one per table; reads run immediately, writes are staged
  container.ts       infrastructure only: config, logger, dynamo, repositories, unitOfWork
  features/
    use-case.ts      useCase() helper
    todos/, projects/  one use case per file
```

Imports point one way, `features → container → data → domain`. `pnpm lint:deps`
(dependency-cruiser, `.dependency-cruiser.cjs`) enforces it:

| Rule | Why |
|---|---|
| `no-circular` | Use cases may call use cases in other features, but the graph must stay acyclic. |
| `no-cross-feature-barrels` | Import `../todos/createTodo.ts`, not `../todos/index.ts`. A barrel drags in the whole feature, which turns an acyclic graph of use cases into cyclic features. |
| `container-is-infrastructure` | The container and data layer never import use cases. |
| `repositories-independent` | Repositories never use each other; atomicity comes from the unit of work. |
| `tables-without-io`, `domain-is-innermost`, `data-below-container` | Keep the direction one-way. |

## Use cases

A use case is a plain function `(ctx, ...args)` defined with `useCase()`. It declares the part of the
container it needs, and apps call it directly:

```ts
// features/projects/createProject.ts
export type CreateProjectDeps = CreateTodoDeps & Pick<Container, 'projectRepository'>;

export const createProject = useCase('createProject', async (ctx: CreateProjectDeps, input: CreateProjectInput) => {
  const project = newProject(input, now);
  const todos = await Promise.all(input.todos.map((t) => createTodo(ctx, t, { projectId: project.id })));
  ctx.projectRepository.create(withTodos(project, todos.map((t) => t.id), now));
  afterCommit(() => ctx.logger.info({ id: project.id }, 'project created'));
  return toProjectDetails(project, todos);
});

// apps/server
(request) => createProject(container, request.body)
```

**Composition.** `useCase()` runs the function in a unit of work (AsyncLocalStorage). Called from a
route, it opens one and commits at the end. Called from another use case, it joins the caller's
unit of work. So `createProject` → `createTodo` ×N is one transaction, and so is
`deleteTodo` → `detachTodoFromProject`.

**Dependencies are type-checked.** A caller's deps must include its callees' deps
(`CreateProjectDeps = CreateTodoDeps & …`). Dropping `todoRepository` from it fails to compile.

**Why one file per use case.** A `todoService` object bundles every todo use case, so each one
inherits the dependencies of all the others. `projects → todos` (for create) plus
`todos → projects` (for delete cleanup) is then a cycle, even though no single use case depends on
itself. With one file per use case, the graph is just `createProject → createTodo` and
`deleteTodo → detachTodoFromProject`.

**Rules of the unit of work** (DynamoDB transactions are write batches, not interactive):

- Staged writes are invisible to reads in the same use case. Express preconditions as conditions
  (`attribute_exists`, `updatedAt = :expected`, `todoIds[i] = :id`), not read-then-check alone.
- Writes return nothing. Return the domain object you built (`withTodos(project, …)`), or re-read.
- At most one write per item and 100 writes per unit of work; `stageWrite` throws early otherwise.
- Side effects (logs, events) go in `afterCommit`, which runs once after the outermost commit and
  never if it fails.
- A unit of work with a single write commits it without a transaction.
- Read-modify-write uses optimistic locking: `updateTodo` replaces only if `updatedAt` is unchanged,
  else 409.

**Branded entities.** `Todo` and `Project` are Zod-branded. Only the domain functions or parsing
(repositories parse stored items) produce them, so a repository cannot be handed an object literal
that skipped the rules.

**Testing.** Pass a fake `ctx` containing only what the use case declares. A composed use case calls
the real callee, so fake at the repository boundary.

## Adding a use case or feature

1. Entities and rules → `domain/`. Storage → `data/tables/` + `tables/index.ts`, a repository,
   `dataModule`, and the table name in `config.ts`
2. `features/<feature>/<useCase>.ts`, exported from the feature's `index.ts` (for apps only)
3. Re-export from `src/index.ts`. Add the route in `apps/server/src/routes/`, run `pnpm generate`,
   and add a CLI command
4. `pnpm check`

## Dependency policy

`pnpm-workspace.yaml` pins exact versions (`savePrefix: ''`) and refuses releases younger
than 3 days (`minimumReleaseAge: 4320`).

`pnpm typecheck` runs TypeScript 7. `@hey-api/openapi-ts` still needs the TypeScript 6
compiler API, so `packages/api-client` pins `typescript@6.0.3` as a devDependency only to satisfy that peer.
dependency-cruiser has the same limit (`typescript <7`), so a `packageExtensions` entry gives it its
own `typescript@6.0.3`.
