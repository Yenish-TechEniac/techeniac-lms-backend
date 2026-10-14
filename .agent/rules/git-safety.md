# Git Safety Rules

These rules are non-negotiable and apply to all agents and automated tools working on `techeniac-lms-backend`.

## Mandatory Approval for State-Changing Commands
- Every Git or GitHub CLI (`gh`) command that alters repository state (creating commits, modifying branches, switching branches, staging files, pushing, rebasing, stashing, tagging, etc.) requires explicit, per-command user approval.
- Present the exact command string to the user before proposing its execution.

## Prohibited Commands & Flags
- **`git add .` and `git add -A`**: Strictly prohibited. Files must be staged individually by exact file path (e.g. `git add path/to/file.ts`).
- **`git push --force` and `git push -f`**: Strictly prohibited. Force-pushing overrides history and can cause irreversible data loss.
- **`git reset --hard`**: Strictly prohibited. Hard resets destroy uncommitted or unstaged changes.
- **`--no-verify`**: Strictly prohibited. Git hooks and validation checks must never be bypassed.

## Branch Discipline
- For TASK B0, work is conducted directly on the existing `main` branch as explicitly requested by the user. Do not create a feature branch.
- For standard future development workflows, feature branches should follow branch naming conventions and use pull requests with squash merging.
