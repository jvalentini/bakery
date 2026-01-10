# AI Agent Instructions

This document provides instructions for AI agents working with this codebase. All commands use Makefile targets for consistency between human and AI workflows.

## Quick Reference

| Task | Command | Exit 0 = Success |
|------|---------|------------------|
| Setup project | `make setup` | Yes |
| Install deps | `make install` | Yes |
| Run dev | `make dev` | Yes |
| Run tests | `make test` | Yes |
| Type check | `make typecheck` | Yes |
| Lint code (auto-fix) | `make lint` | Yes |
| Format code | `make format` | Yes |
| All checks | `make check` | Yes |
| Build | `make build` | Yes |
| Generate docs | `make docs` | Yes |
| Security scan | `make security` | Yes |

## Workflow

### Before Committing
**ALWAYS run `make check` before committing.** This runs type checking, linting, and formatting validation.

```bash
make check           # Run typecheck + lint + oxlint (full validation)
make test            # Run test suite
```

### Common Commands
```bash
make setup           # Initial setup (install tools, git hooks)
make install         # Install dependencies
make dev             # Run in development mode
make lint            # Auto-fix lint issues
make format          # Format code
bd sync              # Sync with Beads (run before git push)
```

### Finding the Next Task
When starting work or looking for what to do next, use Beads to find high-priority tasks:

```bash
bd ready --json              # Get next ready task in JSON format
bv --robot-priority          # Get task priority recommendations
```

**Workflow**: Run `bd ready --json` to see the next task, or combine with `bv --robot-priority` to get AI-recommended priorities. This helps identify what to work on next.

## Task Management

### Beads (bd) - Task Tracking
- **`bd ready`** - Get the next ready task
- **`bd ready --json`** - Get next task in JSON format (for programmatic use)
- **`bd create`** - Create a new task
- **`bd close`** - Close a completed task
- **`bd sync`** - Sync with Beads tool (run before git push)

### Beads Viewer (bv) - Task Analysis
- **`bv --robot-priority`** - Get AI-recommended task priorities
- **`bv --robot-plan`** - Get AI-generated plan for tasks

**Finding the next task**: Run `bd ready --json` or combine with `bv --robot-priority` to identify high-priority work.

## Tool Integration

### UBS - Bug Scanner
Pre-commit validation and bug detection:

```bash
ubs --staged --fail-on-warning    # Scan staged changes, fail on warnings
ubs --staged                      # Scan staged changes (report only)
ubs doctor                        # Check UBS installation and health
```

**When to use**: Before committing to catch bugs and issues in staged files.

### CASS - Cross-Agent Session Search
Search past sessions for solutions and context:

```bash
cass search "query" --robot       # Search sessions with AI context
cass index --stats                # View indexing statistics
```

**When to use**: When looking for similar problems solved in past sessions or need historical context.

### CM - Context Memory
Store and retrieve task context:

```bash
cm context "task" --json          # Get context for a task in JSON format
cm context "task"                 # Get context for a task
```

**When to use**: When working on tasks that need context from previous work or related tasks.

## Code Search Tools

**Prefer semantic search over text search when possible** - it understands code structure and meaning.

### Semantic Search
- **`mgrep`** - Semantic code search (prefer over grep/ripgrep for natural language queries)
  ```bash
  mgrep "What code parsers are available?"
  mgrep "How are chunks defined?" src/models
  mgrep -m 10 "Maximum concurrent workers in parser?"
  ```

### AST-Based Search
- **`grep-ast`** - AST-based pattern matching (finds code patterns, not just text)
- **`ast-grep`** - Fast AST-based code search and transformation

### Text Search
- **`rg` / `ripgrep`** - Fast text search (faster than grep, respects .gitignore)
  ```bash
  rg "functionName"               # Search for text pattern
  rg -t ts "pattern"              # Search only TypeScript files
  rg -i "pattern"                 # Case-insensitive search
  ```
- **`grep`** - Basic text search (fallback if ripgrep unavailable)
- **`ag` (The Silver Searcher)** - Fast text search alternative
- **`ack`** - Text search tool optimized for code

### File Finding
- **`fd`** - Fast file finder (alternative to `find`, respects .gitignore)
  ```bash
  fd "pattern"                    # Find files matching pattern
  fd -e ts                        # Find only .ts files
  ```
- **`fzf`** - Fuzzy finder (interactive file/command selection)
  ```bash
  fzf                            # Interactive fuzzy file finder
  fzf --preview 'bat {}'         # Preview files with syntax highlighting
  ls | fzf                       # Fuzzy search through command output
  git ls-files | fzf             # Fuzzy search through git-tracked files
  ```

**Search strategy**: Use `mgrep` for semantic queries, `rg` for exact text matches, `grep-ast`/`ast-grep` for code patterns, `fd` for finding files, and `fzf` for interactive fuzzy selection.

## Permissions

### Dangerous Commands Requiring Approval

These commands are destructive or irreversible and should **never be run without explicit user approval**:

```bash
rm -rf *                          # Destructive - deletes all files
rm -r *                           # Destructive - recursive deletion
git reset --hard*                 # Irreversible - discards all uncommitted changes
git clean -fd*                    # Destructive - removes untracked files
git push --force*                 # Dangerous - overwrites remote history
git push -f *                     # Dangerous - force push shorthand
```

**Rule**: If a command could cause data loss or overwrite remote history, ask for explicit approval before running.

## Key Patterns

1. **Always use Makefile targets** - They wrap the underlying tools consistently
2. **Run `make check` before committing** - Catches most issues
3. **Exit code 0 means success** - Non-zero means failure
4. **Use Beads (`bd` CLI)** - Run `bd sync` before pushing to remote to sync with Beads tool

## Critical Rules

1. **Never delete files** without explicit user command in current session
2. **Use Bun** for JS/TS (never npm/yarn/pnpm)
3. **Use mise** for runtime versions (bun, node, etc.)
4. **Use Biome + Oxlint** for linting (never ESLint/Prettier)
5. **Use TypeScript** for new code (never JavaScript)

## Code Quality Rules

### Variable Naming
**CRITICAL**: Never add an underscore or prepend an underscore to a variable name in order to fix linting errors unless explicitly approved by the user. Instead, fix the underlying issue (e.g., use the variable, remove it if unused, or refactor the code properly).

### Error Handling
- **Use `neverthrow` Result types** for functions that can fail. Return `Result<T, E>` and use `ok()`/`err()` helpers.
- **Use custom error classes** (extend `CliError`) for domain-specific errors with meaningful names.
- **Always handle errors explicitly** - check `.isErr()` or use `.map()`/`.mapErr()` on Results.
- **Never throw in async functions** - return `Result` types instead.

### Type Safety
- **Use Zod schemas** for runtime validation. Infer TypeScript types with `z.infer<typeof Schema>`.
- **TypeScript strictest config** - all strict checks are enabled. No `any` types (use `unknown` if needed).
- **Always check for `undefined`** when accessing array elements or optional properties (`noUncheckedIndexedAccess` is enabled).

### Async/Promises
- **Always handle promises** - oxlint enforces `no-floating-promises`. Use `await`, `.then()`, or `.catch()`.
- **Mark async functions** - if a function returns a Promise, it should be marked `async` or explicitly return `Promise<T>`.

### Code Style
- **Single quotes** for strings (Biome config).
- **Always semicolons** (Biome config).
- **Use `const`** - `useConst` rule enforces this.
- **Use template literals** instead of string concatenation (`useTemplate` rule).
- **No parameter reassignment** - `noParameterAssign` is an error.

### Testing
- **Write tests** for new functionality using Bun's test runner (`bun:test`).
- **Test error cases** - especially when using Result types, test both success and error paths.
- **Use descriptive test names** - follow the pattern `describe('feature', () => { it('should do something', () => {}) })`.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Run `make check && make test`
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync              # Sync with Beads tool
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
