# AI Agent Instructions

This document provides instructions for AI agents working with this codebase. All commands use Makefile targets for consistency between human and AI workflows.

## Quick Reference

| Task | Command | Exit 0 = Success |
|------|---------|------------------|
| Install deps | `make install` | Yes |
| Run tests | `make test` | Yes |
| Type check | `make typecheck` | Yes |
| Lint code | `make lint` | Yes |
| Fix lint issues (safe) | `make lint-fix` | Yes |
| Fix lint issues (all) | `make lint-fix-all` | Yes |
| Format code | `make format` | Yes |
| All checks | `make check` | Yes |
| Build | `make build` | Yes |
| Generate docs | `make docs` | Yes |
| Security scan | `make security` | Yes |

## Tools Overview

### Bun
Runtime and package manager. Replaces Node.js + npm.

```bash
bun install          # Install dependencies
bun run <script>     # Run package.json script
bun test             # Run tests
bun build            # Compile to binary
```

### Biome
Linter and formatter. Replaces ESLint + Prettier.

```bash
make lint            # Check for issues
make lint-fix        # Auto-fix issues
make format          # Format all files
```

**When to run**: After any code changes, before committing.

### Oxlint
Fast supplementary linter. Catches issues Biome misses.

```bash
make oxlint          # Run oxlint
```

**When to run**: Part of `make check`, runs automatically.

### TypeScript
Type checking only (Bun handles execution).

```bash
make typecheck       # Check types without emitting
make build           # Compile to dist/
```

**When to run**: After changing type signatures or interfaces.

### Lefthook
Git hooks manager. Runs automatically on commit/push.

- **pre-commit**: Runs `biome check` and `oxlint` on staged files
- **pre-push**: Runs `typecheck` and `test`

No manual intervention needed.

## Workflow Commands

### Before Making Changes
```bash
make install         # Ensure deps are current
```

### After Making Changes
```bash
make check           # Run typecheck + lint + oxlint
make test            # Run test suite
```

### Before Committing
```bash
make lint-fix        # Auto-fix lint issues
make format          # Ensure consistent formatting
make check           # Verify everything passes
make test            # Verify tests pass
```

### Full Validation
```bash
make check && make test
```

## Docker Commands

For running without local Bun installation:

```bash
make docker-test     # Run tests in container
make docker-lint     # Run linting in container
make docker-check    # Run all checks in container
make docker-shell    # Interactive shell in container
```

## Understanding Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Lint/type/test failure |
| 2 | File not found |
| 127 | Command not found (missing tool) |

## Common Issues

### "command not found: bun"
```bash
curl -fsSL https://bun.sh/install | bash
```

### "Dependencies out of date"
```bash
make install
```

### "Lint errors on commit"
```bash
make lint-fix
make format
```

### "Type errors"
```bash
make typecheck       # See full error output
```

## File Structure

```
src/
├── cli.ts           # Entry point
├── wizard/          # Scaffolding wizard
│   ├── index.ts     # Wizard runner
│   ├── prompts.ts   # User prompts
│   └── generator.ts # Project generator
├── utils/           # Utilities
│   ├── colors.ts    # Terminal colors
│   ├── errors.ts    # Error classes
│   └── logger.ts    # Logging
templates/           # Project templates
tests/               # Test files
```

## Test Commands

```bash
make test            # Run all tests
make test-watch      # Watch mode
make test-coverage   # With coverage report
```

Tests use Bun's built-in test runner. Files matching `*.test.ts` in `tests/` are automatically discovered.

## Build Commands

```bash
make build           # TypeScript to dist/
make build-binary    # Native binary for current platform
make build-all       # Binaries for all platforms
```

## Release Commands

```bash
make bump-patch      # 0.1.0 -> 0.1.1
make bump-minor      # 0.1.0 -> 0.2.0
make bump-major      # 0.1.0 -> 1.0.0
make release         # Create GitHub release
make release-patch   # Bump + release
```

## Key Patterns

1. **Always use Makefile targets** - They wrap the underlying tools consistently
2. **Run `make check` before committing** - Catches most issues
3. **Exit code 0 means success** - Non-zero means failure
4. **Docker commands mirror local commands** - Just prefix with `docker-`

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
