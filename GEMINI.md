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
- `npm start`: *(coming soon)* Run the compiled backend application.
- `npm run dev`: *(coming soon)* Run the development server with live reload.
- `npm test`: *(coming soon)* Run automated test suite.
- `npm run migration:run`: *(coming soon)* Run TypeORM database migrations.

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
