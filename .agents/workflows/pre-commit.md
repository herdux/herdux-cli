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

- When creating a PR, you MUST use the project's pull request template exactly as written in `.github/PULL_REQUEST_TEMPLATE.md`.
- Do NOT invent a custom format. Fill out ALL fields, checking the appropriate boxes (`[x]`).
- Review the template before writing the PR body.

## 5. Architectural Integrity

- Re-read `AGENTS.md` and verify your changes do not violate the Core Data flow or engine-agnostic logic.
- Verify your changes align with the vision set in `docs/VISION.md`.
- Ask yourself: "Is there anything else needed in the project before this PR is fully complete?"

## 6. Writing Style Rules

- **NO em dashes**: Never use the `—` character in commits, PR titles, PR descriptions, or any documentation.
  - Wrong: `feat: add backup command — supports custom and plain formats`
  - Correct: `feat: add backup command with support for custom and plain formats`
- **NO emojis**: This is a professional CLI tool. Do not use emojis in code, commits, PR descriptions, or technical documentation (README, AGENTS.md, workflow files).
  - Emojis in user-facing output (e.g., `✔`, `✖`, `⚠`) are acceptable when they serve as UI indicators, not decoration.

## Execution

Once you have explicitly verified the 6 steps above, you may proceed with:
`git add ... && git commit -m "..." && git push`
