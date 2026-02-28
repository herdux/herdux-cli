---
description: Pre-commit Checklist (Gold Standard)
---

# Pre-Commit Checklist

Before executing any `git commit` or pushing branches, **you MUST follow this strict procedure**:

## 1. Branch Naming & Association
- Are you on `master`? **STOP**. Never code directly on `master`.
- Always verify you are on a properly named branch (e.g., `feat/new-command`, `fix/bug-name`, `chore/deps`).
- Ensure the branch maps directly to the specific issue or feature you are addressing.

## 2. Commit Organization & Atomicity
- **Single Responsibility Principle**: Ensure each commit does only ONE thing.
- If you have mixed changes (e.g., you updated a core engine AND you updated the CI pipeline), **split them** into two distinct commits.
- Use explicit, standardized commit messages (e.g., `feat(cli): ...`, `fix(infra): ...`, `docs: ...`).

## 3. Versioning & Documentation Checks
- Ask yourself: "Did this change add a new feature, a patch, or a breaking change?"
- If needed, did you update `"version": "x.y.z"` in `package.json`?
- **CRITICAL**: If you updated the version, you MUST also sync the version shield in both `README.md` and `README.pt-BR.md`.

## 4. Pull Request Preparation
- When creating or preparing a PR, you MUST use the project's PULL REQUEST TEMPLATE.
- Review `.github/PULL_REQUEST_TEMPLATE.md` and fill out ALL fields, checking the appropriate boxes (`[x]`).

## 5. Architectural Integrity
- Re-read `AGENTS.md` and verify your changes do not violate the Core Data flow or engine-agnostic logic.
- Verify your changes align with the vision set in `docs/VISION.md`.
- Ask yourself: "Is there anything else needed in the project before this PR is fully complete?"

## Execution
Once you have explicitly verified the 5 steps above, you may proceed with:
`git add ... && git commit -m "..." && git push`
