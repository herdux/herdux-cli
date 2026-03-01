## Type

<!-- Mark exactly ONE type below -->

- [ ] `feat` — new feature or command
- [ ] `fix` — bug fix
- [ ] `refactor` — internal restructuring, no behavior change
- [ ] `test` — adding or improving tests only
- [ ] `chore` — tooling, config, scripts, docs, assets

---

## Description

<!-- What does this PR do? Why was it needed? Be direct. -->

**Related issues:** Closes # <!-- or "N/A" -->

---

## Changes

<!-- Bullet list of what changed and where -->

- ***

## How to Test

<!-- Steps to validate this change locally. Mark N/A if no code was changed. -->

1.

---

## Quality Checklist

**Always required:**

- [ ] Follows architecture and layer rules (`AGENTS.md`)
- [ ] Formatted with `npm run lint:fix`
- [ ] Branch is off `master`, not a direct commit to it

**Required for `feat` / `fix` / `refactor`:**

- [ ] Commands remain engine-agnostic (no `psql`, `mysql`, or binary names in `src/commands/`)
- [ ] Unit tests pass: `npm run test:unit`
- [ ] Integration tests pass: `npm run test:integration`

**Required if engines or commands were changed:**

- [ ] E2E tests pass for the affected engine(s): `npm run test:e2e:pgsql` / `test:e2e:mysql`

**Required if user-facing behavior changed:**

- [ ] `README.md` and `README.pt-BR.md` updated accordingly

---

## Screenshots

<!-- Only if there are visible changes to CLI output or prompts. Delete this section otherwise. -->
