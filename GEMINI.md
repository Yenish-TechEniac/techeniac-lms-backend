# Techeniac LMS Backend

Techeniac LMS Backend provides the REST API, domain business logic, and PostgreSQL data persistence for the Techeniac Learning Management System. It is engineered with Node.js 24, Express, TypeScript strict mode, and TypeORM on Neon PostgreSQL.

## Repository Map

- `src/main.ts`: Application bootstrap entry point.
- `src/app.ts`: Core application configuration.
- `src/core/`: Cross-cutting concerns (config, db, errors, health, http, logging, openapi).
- `src/modules/`: Domain feature modules.
- `src/migrations/`: TypeORM schema migrations.
- `tests/`: Integration and unit test suites.
- `.agent/`: Operational guides, architecture decisions, and non-negotiable rules.

## Available Commands

- `npm run typecheck`: Run static type checking via TypeScript compiler (`tsc --noEmit`).
- `npm run build`: Compile TypeScript source code to `dist/`.
- `npm run lint`: Lint source files with ESLint (`--max-warnings 0`).
- `npm run lint:test-rules`: Test ESLint fixtures against expected rule IDs.
- `npm run format`: Format code with Prettier.
- `npm run format:check`: Check code formatting with Prettier.
- `npm run dev`: Run the development server with live reload (`tsx watch src/main.ts`).
- `npm start`: Run the compiled backend application (`node dist/main.js`).
- `npm run migration:run`: Run TypeORM database migrations via direct connection.
- `npm run migration:revert`: Revert the most recently executed migration.
- `npm run migration:generate`: Generate a new migration from entity changes.
- `npm run migration:create`: Create a blank migration file.
- `npm test`: _(coming soon)_ Run automated test suite.

## Non-Negotiable Rules

- **Git Safety**: Never execute state-changing Git/GitHub commands without per-command approval. Prohibit `git add .`, `git add -A`, `git push --force`, `git reset --hard`, and `--no-verify`.
- **Security**: Never commit, inspect, or log real `.env` contents or credentials.
- **Workflow**: Document architectural choices in `.agent/decisions.md`.

## Agent Governance Links

- [Git Safety Rules](.agent/rules/git-safety.md)
- [Security Rules](.agent/rules/security.md)
- [Architecture Overview](.agent/architecture.md)
- [Development Conventions](.agent/conventions.md)
- [Architecture Decision Records](.agent/decisions.md)
