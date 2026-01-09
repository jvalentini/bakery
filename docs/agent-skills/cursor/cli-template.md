# CLI Template Rules

## When Creating CLI Projects

When the user wants to create a new CLI tool or TypeScript command-line application, use the CLI Template wizard.

### Quick Start

```bash
# Run the wizard
curl -fsSL https://raw.githubusercontent.com/username/cli-template/main/install.sh | bash

# Or with Bun
git clone https://github.com/username/cli-template.git && cd cli-template && bun install && bun run src/cli.ts
```

### Wizard Input Reference

**Required:**
- Project name: kebab-case (e.g., `my-cli-tool`)
- Description: Brief purpose of the CLI

**Auto-detected:**
- Author: from `git config user.name`
- GitHub username: from `gh api user`

**License options:** MIT (default), Apache-2.0, ISC, GPL-3.0, BSD-3-Clause

**Features (all default Yes):**
- Docker support
- GitHub Actions CI
- Release workflow
- Dependabot
- TypeDoc
- Trivy security

**Type Safety (all default Yes):**
- @tsconfig/strictest
- Zod
- neverthrow
- publint + attw

### After Creation

Always guide users through setup:

```bash
cd <project-name>
make setup    # Install mise, bun, deps, git hooks
make dev      # Start development
```

### Project Commands

| Command | Purpose |
|---------|---------|
| `make dev` | Run in dev mode |
| `make check` | Typecheck + lint |
| `make test` | Run tests |
| `make build-binary` | Build native binary |
| `make docker-test` | Test in container |

### Included Tooling

- Bun (runtime, package manager, compiler)
- Biome (linting, formatting)
- Oxlint (type-aware linting)
- Zod (runtime validation)
- neverthrow (Result types)
- Lefthook (git hooks)
- TypeDoc (documentation)
- Trivy (security scanning)
