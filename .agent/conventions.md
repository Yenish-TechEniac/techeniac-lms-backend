# Development Conventions

## Branch Naming

For feature and maintenance work (post-foundation setup), use semantic branch prefixes:

- `feat/<short-description>`: New domain feature or functionality.
- `fix/<short-description>`: Bug fix.
- `chore/<short-description>`: Tooling, dependency updates, maintenance.
- `docs/<short-description>`: Documentation changes.
- `refactor/<short-description>`: Code restructuring without functional behavior changes.
- `test/<short-description>`: Adding or modifying test suites.

_Note_: For TASK B0, work was explicitly authorized to occur directly on `main` to establish the initial repository baseline.

## Commit Standards

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `<type>(<optional scope>): <description>`
- Examples:
  - `feat(auth): add user registration endpoint`
  - `fix(db): correct connection pool timeout`
  - `chore(deps): update typeorm to 0.3.20`

## Branching & Promotion Strategy

The repository follows a tiered branch promotion hierarchy:

1. **Feature Branches (`feat/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`)**:
   - Branched off `dev`.
   - Work is developed, tested locally, and submitted via Pull Request targeting `dev`.
2. **`dev` (Development / Integration)**:
   - Aggregates completed features and integration testing.
   - Protected branch: direct commits and direct pushes are strictly prohibited.
   - Promoted to `staging` via Pull Request.
3. **`staging` (Pre-production / QA)**:
   - Mirrors production environment for final end-to-end verification.
   - Protected branch: direct commits and direct pushes are strictly prohibited.
   - Promoted to `main` via Pull Request.
4. **`main` (Production)**:
   - Represents production-ready code.
   - Protected branch: direct commits and direct pushes are strictly prohibited.
   - All merges occur exclusively through reviewed and CI-passed Pull Requests with squash merging.

## Branch Protection & Pull Request Discipline

- **Direct Commits Prohibited**: Direct commits to `main`, `staging`, and `dev` are blocked locally by `.husky/pre-commit` and remotely by GitHub Branch Protection / Rulesets.
- **Diff Size**: Pull requests should ideally remain under ~400 lines of changed code to facilitate thorough, high-quality peer review.
- **Merge Strategy**: Squash merging is mandatory for feature branches merged into `dev`, preserving an atomic history with Conventional Commits.
- **Automated Verification**: Every Pull Request between any branch must pass all CI checks (Gitleaks, typecheck, lint, architectural rules, format check, and build) before merging.
