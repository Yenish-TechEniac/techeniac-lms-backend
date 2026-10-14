# Architecture Decision Records (ADRs)

## ADR-001: Node.js 24 LTS Runtime
- **Date**: 2026-10-14
- **Status**: Accepted
- **Context**: The backend requires a stable, long-term supported Node.js execution runtime that offers high performance, modern ECMAScript standard support, and long-term security maintenance.
- **Options**:
  1. Node.js 20 LTS
  2. Node.js 22 LTS
  3. Node.js 24 LTS
- **Choice**: Node.js 24 LTS with `.nvmrc` set to `24` and `package.json` engines pinned to `>=24 <25`.
- **Reasons**: Node 24 is the modern LTS release offering updated V8 engine optimizations, standard native cryptographic primitives, and long-term vendor support.
- **Consequences**: Local development and deployment environments must use Node 24. Older Node runtime environments are unsupported.

---

## ADR-002: Module System Selection (CommonJS)
- **Date**: 2026-10-14
- **Status**: Accepted
- **Context**: Node.js and TypeScript support both CommonJS (CJS) and ECMAScript Modules (ESM). The project depends on TypeORM CLI for schema migrations and metadata reflection (`emitDecoratorMetadata`).
- **Options**:
  1. Pure ESM (`"type": "module"`)
  2. CommonJS (CJS)
- **Choice**: CommonJS.
- **Reasons**: TypeORM CLI relies heavily on runtime decorator reflection (`reflect-metadata`) and dynamic entity discovery. In Node.js, pure ESM often requires experimental loaders (`--loader ts-node/esm` or custom resolution flags) to load TypeScript entities and migration files dynamically. CommonJS provides seamless compatibility with TypeORM CLI, `ts-node`, and ecosystem tooling without fragile loader flags.
- **Consequences**: TypeScript compiles to CommonJS (`"module": "CommonJS"`). Code uses standard `import`/`export` syntax in source TypeScript, which is compiled down to CJS outputs.

---

## ADR-003: TypeScript Compiler Strictness Flags
- **Date**: 2026-10-14
- **Status**: Accepted
- **Context**: We need to establish static analysis guarantees in `tsconfig.json` while evaluating specific strictness flags (`noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`).
- **Options**:
  1. Baseline `strict: true` only.
  2. Enable all optional strictness flags without evaluation.
  3. Enable flags that provide strong type safety without conflicting with ORM/HTTP library typing patterns.
- **Choice**:
  - `strict`: `true`
  - `noUncheckedIndexedAccess`: `true` (Enabled) — Array and dictionary element access evaluates as `T | undefined`, eliminating unseen runtime index errors.
  - `noImplicitOverride`: `true` (Enabled) — Subclasses overriding base class methods must be explicitly marked with `override`, preventing subtle inheritance bugs.
  - `exactOptionalPropertyTypes`: `false` (Disabled) — This flag prevents assigning `undefined` to optional properties (`{ prop?: string }`). In Express and TypeORM, optional entity and request properties frequently pass explicit `undefined` or omit properties interchangeably. Enabling this flag introduces significant friction and type friction with library definitions without substantial safety gains.
- **Reasons**: Balances rigorous type safety and safety against runtime `undefined` bugs with library ecosystem compatibility.
- **Consequences**: Developers must handle possible `undefined` values when indexing arrays/records and use the `override` keyword when extending classes.

---

## ADR-004: Decoupled Repositories vs Monorepo
- **Date**: 2026-10-14
- **Status**: Accepted
- **Context**: The Techeniac LMS consists of an API backend and a separate user-facing frontend. We must choose repository organization.
- **Options**:
  1. Monorepo housing both backend and frontend.
  2. Decoupled individual repositories (`techeniac-lms-backend` and separate frontend repo).
- **Choice**: Decoupled individual repositories.
- **Reasons**:
  - Independent deployment cycles and CI/CD pipelines.
  - Granular access control and permission management.
  - Reduced cognitive complexity and repository footprint for backend services.
  - Clean separation of concerns between client presentation and server API.
- **Consequences**: API contracts must be well-documented (OpenAPI/Swagger) to maintain synchronization between frontend and backend.

---

## ADR-005: Squash Merging for Feature Branches
- **Date**: 2026-10-14
- **Status**: Accepted
- **Context**: A Git branching and merging policy is required to maintain a readable, bisectable commit history on the default branch.
- **Options**:
  1. Merge commits (`git merge --no-ff`)
  2. Rebase and fast-forward
  3. Squash merge via Pull Requests
- **Choice**: Squash merging for all feature branches merged into `main`.
- **Reasons**:
  - Eliminates messy intermediate development commits ("wip", "fix typo") from the main history.
  - Produces a single, atomic commit per pull request formatted with Conventional Commits.
  - Simplifies rollbacks (`git revert`) and git bisect operations.
- **Consequences**: Developers can commit frequently on their feature branches; upon PR approval, all commits are collapsed into one clean semantic commit on `main`.
