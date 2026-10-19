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
- **Choice**: Squash merging for all feature branches merged into `dev`, with structured PR promotion across `dev` -> `staging` -> `main`.
- **Reasons**:
  - Eliminates messy intermediate development commits ("wip", "fix typo") from the integration history.
  - Produces a single, atomic commit per pull request formatted with Conventional Commits.
  - Simplifies rollbacks (`git revert`) and git bisect operations.
- **Consequences**: Developers can commit frequently on their feature branches; upon PR approval, commits are collapsed into one clean semantic commit on `dev`. Promotional releases from `dev` to `staging` and `main` preserve release traceability.

---

## ADR-006: Quality Gates, Static Analysis, and Hook Pipeline

- **Date**: 2026-10-14
- **Status**: Accepted
- **Context**: To maintain codebase health, prevent secret leakage, and enforce architectural boundaries across contributions, automated static analysis and pre-commit checks are required.
- **Options**:
  1. Manual PR reviews and ad-hoc linting.
  2. Legacy ESLint rc configuration with standard formatting plugins.
  3. ESLint 9 flat configuration (`eslint.config.mjs`) with type-aware TypeScript rules, custom in-config architectural boundary enforcement, Prettier separation, Gitleaks pre-commit secret detection, and commitlint hook validation.
- **Choice**: Option 3.
- **Reasons**:
  - ESLint flat configuration is the standard modern configuration format for ESLint 9+.
  - Type-aware TypeScript rules catch subtle promise mishandling (`no-floating-promises`, `no-misused-promises`) and unsafe types (`no-explicit-any`).
  - Custom in-config ESLint architecture rules provide automated enforcement of repository query confinement (`architecture/raw-queries-only-in-repositories`) and modular encapsulation (`architecture/cross-module-index-imports`) without extra external dependencies.
  - Prettier handles code formatting deterministically, with `eslint-config-prettier` preventing rule collisions.
  - Pre-commit scanning with Gitleaks guarantees secrets are caught locally before reaching remotes, with fallback detection failing clearly if Gitleaks is uninstalled.
  - Commitlint enforces Conventional Commits standard on commit messages to ensure squash-merged history remains structured and semantically versionable.
- **Consequences**:
  - Developers must have Gitleaks installed locally to commit.
  - Commits that introduce unresolved promises, raw SQL queries outside repositories, or direct internal module imports will fail static checks.
  - `lint-fixtures/` is excluded from standard lint/formatting runs and tested separately via `npm run lint:test-rules`.

---

## ADR-007: Background Job Processing with BullMQ and Redis

- **Date**: 2026-10-15
- **Status**: Proposed
- **Context**: The LMS backend requires asynchronous background task processing for decoupled, fault-tolerant operations such as notification/email delivery, asynchronous file generation, data imports, and scheduled maintenance tasks.
- **Options**:
  1. In-process Node.js event emitters or setTimeout-based queues.
  2. Heavy message brokers (RabbitMQ, Apache Kafka).
  3. BullMQ backed by Redis.
- **Choice**: Option 3 (BullMQ backed by Redis).
- **Reasons**:
  - In-process queues lose state on application restarts or crashes and cannot distribute load across multiple horizontal API instances.
  - Enterprise brokers like Kafka or RabbitMQ introduce substantial infrastructure complexity disproportionate to current requirements.
  - BullMQ provides battle-tested, high-throughput Redis-backed queues with Lua script atomicity, built-in exponential backoff, job retention management, and first-class TypeScript support.
  - In local development:
    - On Linux, Redis can run natively as a system daemon (`sudo systemctl start redis-server`).
    - On macOS, Redis can run via Homebrew (`brew install redis && brew services start redis`) or Docker (`docker run -d -p 6379:6379 --name redis redis:alpine`).
  - In production, BullMQ connects seamlessly to managed Redis services or self-hosted Redis servers with password and TLS support.
- **Consequences**:
  - Implementation of core queue and worker factories in `src/core/queue/` is planned for a dedicated future PR.
  - Redis connection configurations will be centralized and validated via `src/core/config/` once implemented.
  - Local development environments will require a running Redis instance once this capability is introduced.
  - Production deployments will require configured `REDIS_HOST` or `REDIS_URL` connection parameters.

---

## ADR-008: Centralized Reusable Validation Primitives with Zod

- **Date**: 2026-10-15
- **Status**: Proposed
- **Context**: Across domain modules, input validation rules for common data types risk duplication, inconsistency, and divergent security requirements if implemented ad-hoc per endpoint.
- **Options**:
  1. Define individual Zod schemas inside each domain module independently.
  2. Implement validation using annotations or class-validator decorators.
  3. Establish a single source of truth for reusable atomic schemas and HTTP validation middleware in `src/core/validation/`.
- **Choice**: Option 3 (Single source of truth in `src/core/validation/`).
- **Reasons**:
  - Enforces uniform security criteria across the entire platform.
  - Reduces redundant code and simplifies future schema alignment between backend and frontend.
  - Provides a standard `validateRequest` middleware that normalizes 400 Bad Request error payloads with precise field errors.
  - Zod offers runtime type safety with direct TypeScript inference without decorator reflection overhead.
- **Consequences**:
  - Implementation of shared validation primitives and `validateRequest` middleware in `src/core/validation/` is planned for a dedicated validation PR.
  - Once implemented, domain modules will import standard primitives from `src/core/validation`.
  - Changes to platform-wide constraints will be centralized in one location.

---

## ADR-009: Continuous Integration (CI) Pipeline for Pull Requests

- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Automated quality gates are required on all pull requests across all branches to prevent broken builds, formatting deviations, secret leakages, or architectural boundary violations from entering the codebase.
- **Options**:
  1. Manual pre-merge checklists.
  2. Heavy CI pipeline requiring Docker container orchestration and live DB services before DB setup is complete.
  3. Lightweight, container-free GitHub Actions CI workflow running Node 24, Gitleaks, type checking, ESLint 9 with architectural boundary tests, Prettier format verification, and TypeScript build compilation.
- **Choice**: Option 3 (`.github/workflows/ci.yml`).
- **Reasons**:
  - Automatically triggers on all pull requests from any branch to any branch (`pull_request: types: [opened, synchronize, reopened]`).
  - Matches the Node 24 LTS runtime specified in ADR-001.
  - Enforces Gitleaks pre-commit rules remotely in CI to ensure no secrets or `.env` variables are merged.
  - Executes strict static analysis (`tsc --noEmit`), ESLint with architecture rules, fixture rule checks, Prettier checks, and production compilation (`tsc`).
  - Excludes container dependencies until database persistence and migration setup are fully established.
- **Consequences**:
  - Pull requests must pass all static verification stages before merging.
  - Future database migration tests (`up -> down -> up`) can be cleanly appended once database configurations are wired.

---

## ADR-010: Multi-Stage Branching Strategy and Direct Commit Protection

- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: To establish a reliable software delivery lifecycle, direct commits to critical branches (`main`, `staging`, `dev`) must be prevented, and promotion must follow a structured pipeline (`feature` -> `dev` -> `staging` -> `main`).
- **Options**:
  1. Trunk-based development with direct commits to `main`.
  2. Multi-stage promotion (`dev` -> `staging` -> `main`) without automated branch guards.
  3. Tiered promotion hierarchy with dual-layer commit protection (local Husky `pre-commit` hook aborting direct commits on `main`, `staging`, and `dev`; GitHub Rulesets blocking direct pushes and requiring passing CI status checks).
- **Choice**: Option 3.
- **Reasons**:
  - Prevents unintended breaking changes from directly entering integration, staging, or production.
  - Gives developers a safety net locally through `.husky/pre-commit` which blocks accidental commits while on `main`, `staging`, or `dev`.
  - Enforces review, squash merging, and CI validation across each promotion stage.
- **Consequences**:
  - Developers must branch from `dev` (`feat/*`, `fix/*`, `chore/*`) and submit Pull Requests.
  - Promotion between stages requires Pull Requests.
  - GitHub branch protection rules must be kept active on remote repository settings.

---

## ADR-011: Standardized AuditableEntity for Database Persistence

- **Date**: 2026-10-16 (Updated 2026-10-19)
- **Status**: Accepted
- **Context**: The LMS database schema requires uniform auditing and identification columns across all tables: UUID primary keys (`gen_random_uuid()`), timestamp with time zone creation and update tracking (`CURRENT_TIMESTAMP`), soft delete support via `deleted_at`, and audit actor tracking (`created_by`, `updated_by`). Additionally, naming must not shadow TypeORM's built-in `BaseEntity` (Active Record class) to prevent auto-import collisions and startup errors.
- **Options**:
  1. Define `id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, and `updated_by` independently on each TypeORM entity.
  2. Implement an abstract `BaseEntity` in `src/core/db/base.entity.ts`.
  3. Implement an abstract `AuditableEntity` in `src/core/db/auditable.entity.ts` that includes UUID primary key, timestamps, soft delete, and actor audit fields without shadowing TypeORM's `BaseEntity`.
- **Choice**: Option 3 (`AuditableEntity` in `src/core/db/auditable.entity.ts`).
- **Reasons**:
  - Eliminates duplicate column definitions across domain entity schemas.
  - Prevents IDE auto-import conflicts with TypeORM's own Active Record `BaseEntity`.
  - Guarantees consistent PostgreSQL data types (`uuid`, `timestamptz`) and snake_case column names.
  - Pre-provisions `created_by` and `updated_by` nullable UUID audit columns across all tables before domain entities are created.
  - Native TypeORM `@CreateDateColumn`, `@UpdateDateColumn`, and `@DeleteDateColumn` support automated timestamp management and soft delete querying without boilerplate.
- **Consequences**:
  - All domain entities created in `src/modules/*/entities/` must extend `AuditableEntity`.
  - Auditing, soft-delete, and actor tracking semantics are applied consistently throughout the repository.

---

## ADR-012: Standardized HTTP Status Codes and Centralized Environment Configuration

- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: HTTP status codes were represented as literal numbers in route handlers and middleware. Additionally, direct access to `process.env` across disparate domain modules risks runtime configuration drift, unvalidated inputs, and tight coupling to host environments.
- **Options**:
  1. Continue using literal status codes (e.g. `200`, `503`, `204`) and allow ad-hoc `process.env` access.
  2. Implement a custom status code enum and manual convention for environment access.
  3. Adopt the battle-tested `http-status-codes` library across all controllers/middlewares (re-exported via `src/core/http`), enforce centralized environment loading via `src/core/config/` (Zod validation), and automate restriction via ESLint `no-process-env`.
- **Choice**: Option 3.
- **Reasons**:
  - `http-status-codes` eliminates magic status numbers and aligns with industry TypeScript standards.
  - Re-exporting `StatusCodes` via `src/core/http` provides seamless core module cohesion.
  - Centralizing environment parsing through Zod in `src/core/config/` guarantees strongly typed configuration at startup.
  - Automating enforcement via the ESLint `no-process-env` rule (with override only for `src/core/config/**`) ensures zero modules can bypass the centralized configuration.
- **Consequences**:
  - All route handlers and middlewares must use `StatusCodes.*` from `http-status-codes` (or `src/core/http`).
  - No file outside `src/core/config/` is permitted to reference `process.env`.

---

## ADR-013: Express 5 Adoption and Native Node 24 Environment Loading

- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Express 4 requires boilerplate try-catch or wrapper libraries (e.g. `express-async-handler`) to handle asynchronous errors and forward rejected promises to error middleware. In addition, Node 24 LTS provides standard built-in `.env` file loading via `process.loadEnvFile()`, making the third-party `dotenv` dependency redundant.
- **Options**:
  1. Retain Express 4 with async route wrapper utilities and `dotenv`.
  2. Adopt Express 5 and native Node 24 `process.loadEnvFile()`.
- **Choice**: Option 2.
- **Reasons**:
  - Express 5 is the modern stable major line and natively routes rejected promises in async route handlers directly to Express error middleware without wrapper functions.
  - Using Node 24's native `process.loadEnvFile()` eliminates third-party runtime dependencies, shrinking the attack surface and reducing maintenance overhead.
  - Native loading integrates directly with standard Node configuration patterns.
- **Consequences**:
  - `express` is upgraded to `^5.0.0` with `@types/express` `^5.0.0`.
  - `dotenv` is completely removed from dependencies.
  - Async route handlers no longer require manual try-catch wrappers to forward rejected promises.

---

## ADR-014: Structured Logging with Pino

- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: Production observability requires structured JSON log outputs with standard severity levels, ISO timestamps, request correlation via child loggers, and full error stack preservation. The initial logger implementation printed string-interpolated logs and dropped error stack traces.
- **Options**:
  1. Continue using custom `console`-based wrapper with string interpolation.
  2. Adopt Winston.
  3. Adopt Pino (`pino`).
- **Choice**: Option 3 (Pino).
- **Reasons**:
  - Pino is an industry-standard, high-performance structured JSON logger for Node.js with near-zero overhead.
  - Built-in `err` serializer captures full Error stack traces, error names, and cause chains without manual stringification.
  - First-class support for child loggers (`logger.child({ requestId })`) enables granular request-scoped correlation.
  - Dynamic log level adjustments via `logger.level`.
  - Seamless ingestion by modern observability platforms (Datadog, CloudWatch, GCP Cloud Logging).
- **Consequences**:
  - `pino` is added as a runtime dependency in `src/core/logging`.
  - Loggers must pass the error object itself (`logger.error({ err }, 'message')`) rather than just `err.message`.
  - Log output is emitted as machine-readable JSON in all environments.

---

## ADR-015: Standardized JSON Error Hierarchy and Global Error Middleware

- **Date**: 2026-10-19
- **Status**: Accepted
- **Context**: An enterprise API requires consistent machine-readable error envelopes (`{ error: { code, message, details? } }`) across all responses. Without explicit error middleware, Express emits HTML stack trace pages on malformed client JSON or unhandled exceptions, leaking server paths and breaking frontend JSON parsing. Additionally, default Express headers (`X-Powered-By`) expose server implementation details.
- **Options**:
  1. Rely on Express default HTML error pages and ad-hoc error formatting per route.
  2. Implement custom global `notFoundMiddleware`, `errorMiddleware`, `app.disable('x-powered-by')`, and a centralized `AppError` hierarchy in `src/core/errors/`.
- **Choice**: Option 2.
- **Reasons**:
  - Enforces a predictable JSON error contract across all endpoints.
  - Intercepts body-parser syntax errors (400) and unhandled routes (404), converting them to JSON instead of HTML.
  - Sanitizes 500 internal server errors to prevent stack trace leaks to API consumers while logging full traces with Pino.
  - Disables the `X-Powered-By` header to prevent technology fingerprinting.
- **Consequences**:
  - All errors thrown in domain modules, middleware, or services must inherit from `AppError` (`src/core/errors`).
  - Terminal middleware chain in `src/app.ts` must always conclude with `notFoundMiddleware` followed by `errorMiddleware`.
