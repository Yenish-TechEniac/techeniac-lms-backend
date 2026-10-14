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

## Pull Request Sizing & Discipline

- **Diff Size**: Pull requests should ideally remain under ~400 lines of changed code to facilitate thorough, high-quality peer review.
- **Merge Strategy**: Squash merging is mandatory for feature branches merged into `main`. This maintains a linear, clean history on `main` while giving developers freedom to create granular commits during development.
- **Main Branch Protection**: Direct commits to `main` are prohibited during standard team workflows. Changes must pass automated checks and code review before merging.
