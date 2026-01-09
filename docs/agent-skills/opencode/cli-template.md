# CLI Template - Project Creation

> Use this skill when the user wants to create a new CLI tool, command-line application, or TypeScript CLI project.

## Triggers

- User asks to "create a CLI tool" or "scaffold a CLI project"
- User wants to build a command-line application with TypeScript
- User mentions needing a CLI with modern tooling (Bun, Biome, etc.)
- User asks about creating a distributable CLI binary

## Instructions

### Creating a New CLI Project

Run the CLI Template wizard:

```bash
# Option 1: Install script
curl -fsSL https://raw.githubusercontent.com/username/cli-template/main/install.sh | bash

# Option 2: Clone and run with Bun
git clone https://github.com/username/cli-template.git
cd cli-template
bun install
bun run src/cli.ts
```

### Wizard Prompts

The wizard collects:

1. **Project name** - kebab-case (e.g., `my-awesome-cli`)
2. **Description** - What the CLI does
3. **Author name** - Auto-detected from git config
4. **GitHub username** - Auto-detected from gh CLI
5. **License** - MIT (default), Apache-2.0, ISC, GPL-3.0, BSD-3-Clause

Feature toggles (all default to Yes):
- Docker support
- GitHub Actions CI
- Release workflow (auto-build binaries)
- Dependabot
- TypeDoc documentation
- Trivy security scanning

Type safety options (all default to Yes):
- @tsconfig/strictest
- Zod (runtime validation)
- neverthrow (error handling)
- publint + attw (package validation)

### Post-Creation

```bash
cd <project-name>
make setup    # Install tools and dependencies
make dev      # Run in development mode
```

### Generated Structure

```
<project-name>/
├── src/cli.ts           # Entry point
├── src/utils/           # Helpers
├── tests/               # Tests
├── .github/workflows/   # CI/CD
├── Dockerfile           # Container
├── Makefile             # Commands
├── AGENTS.md            # AI instructions
└── biome.json           # Linting
```

### Key Commands

- `make dev` - Development mode
- `make check` - Type check + lint
- `make test` - Run tests
- `make build-binary` - Build native binary

## Tooling

- **Bun** - Runtime and package manager
- **Biome** - Linter/formatter
- **Oxlint** - Type-aware linting
- **Zod** - Runtime validation
- **neverthrow** - Error handling
- **Lefthook** - Git hooks
