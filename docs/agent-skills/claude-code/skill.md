---
description: Create new CLI tools using the CLI Template wizard. Use when user wants to scaffold a new TypeScript CLI project with modern tooling.
---

# CLI Template - Project Creation Skill

Use this skill when the user wants to create a new CLI tool, command-line application, or TypeScript CLI project.

## When to Use This Skill

- User asks to "create a CLI tool" or "scaffold a CLI project"
- User wants to build a command-line application with TypeScript
- User mentions needing a CLI with modern tooling (Bun, Biome, etc.)
- User asks about creating a distributable CLI binary

## How to Create a New CLI Project

### Method 1: Interactive Wizard (Recommended)

Run the wizard using the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/username/cli-template/main/install.sh | bash
```

Or clone and run directly with Bun:

```bash
git clone https://github.com/username/cli-template.git
cd cli-template
bun install
bun run src/cli.ts
```

### Wizard Prompts Explained

The wizard asks for the following information:

#### Project Details

| Prompt | Description | Example |
|--------|-------------|---------|
| Project name | kebab-case name for the CLI | `my-awesome-cli` |
| Description | Short description of what the CLI does | `A tool for managing deployments` |
| Author name | Your name (auto-detected from git) | `John Doe` |
| GitHub username | For repository URLs (auto-detected from gh CLI) | `johndoe` |

#### License Options

| License | Description |
|---------|-------------|
| MIT | Simple and permissive - recommended for most projects |
| Apache-2.0 | Permissive with explicit patent grant |
| ISC | Simplified MIT - functionally equivalent |
| GPL-3.0 | Copyleft - requires derivative works to be open source |
| BSD-3-Clause | Permissive with attribution requirement |

#### Feature Options

| Feature | Default | Description |
|---------|---------|-------------|
| Docker support | Yes | Containerized development environment |
| GitHub Actions CI | Yes | Automated testing on push/PR |
| Release workflow | Yes | Auto-build binaries for macOS/Linux/Windows on tags |
| Dependabot | Yes | Automated dependency updates |
| TypeDoc | Yes | API documentation generation |
| Trivy | Yes | Security vulnerability scanning |

#### Type Safety Options

| Feature | Default | Description |
|---------|---------|-------------|
| @tsconfig/strictest | Yes | Maximum TypeScript strictness |
| Zod | Yes | Runtime type validation for CLI options |
| neverthrow | Yes | Type-safe error handling without exceptions |
| publint + attw | Yes | Package validation before publishing |

### Post-Creation Steps

After the wizard completes, guide the user through:

```bash
cd <project-name>
make setup          # Install mise, bun, dependencies, git hooks
make dev            # Run the CLI in development mode
```

### Generated Project Structure

```
<project-name>/
├── src/
│   ├── cli.ts              # Entry point with argument parsing
│   └── utils/              # Colors, errors, logging utilities
├── tests/                  # Test files
├── .github/workflows/      # CI + release pipelines
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Dev services
├── Makefile                # All commands
├── AGENTS.md               # AI agent instructions
├── biome.json              # Linter/formatter config
├── lefthook.yml            # Git hooks
└── tsconfig.json           # TypeScript config
```

### Common Commands After Creation

| Command | Description |
|---------|-------------|
| `make dev` | Run CLI in development mode |
| `make check` | Run typecheck + lint + oxlint |
| `make test` | Run tests |
| `make build` | Build TypeScript to dist/ |
| `make build-binary` | Build native binary for current platform |
| `make docker-test` | Run tests in Docker |

## Tooling Summary

The generated CLI includes:

- **Bun**: Fast runtime, package manager, and binary compiler
- **Biome**: Linter and formatter (replaces ESLint + Prettier)
- **Oxlint**: Type-aware linting for async/promise bugs
- **Zod**: Runtime type validation with TypeScript inference
- **neverthrow**: Type-safe Result types for error handling
- **Lefthook**: Git hooks for pre-commit/pre-push checks
- **TypeDoc**: API documentation from JSDoc comments
- **Trivy**: Security scanning for vulnerabilities

## Example Interaction

User: "I want to create a CLI tool for managing my dotfiles"

Response:
1. Run the CLI template wizard
2. Name it `dotfiles-manager`
3. Add description: "A CLI for managing and syncing dotfiles"
4. Enable all features (defaults are good)
5. After creation: `cd dotfiles-manager && make setup && make dev`
