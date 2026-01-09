# CLI Template

A project generator that scaffolds modern TypeScript CLI tools with best-in-class tooling pre-configured.

## Why?

Starting a new CLI project means hours of setup: configuring TypeScript, choosing a linter, setting up formatters, writing CI pipelines, configuring Docker, creating Makefiles. This tool eliminates that friction.

Run one command, answer a few questions, and get a production-ready CLI project with:

- **TypeScript + Bun** for fast development and execution
- **Biome + Oxlint** for comprehensive linting and formatting
- **Lefthook** for git hooks that catch issues before commit
- **GitHub Actions** for CI/CD and cross-platform binary releases
- **Docker** for containerized development
- **Makefile** for consistent commands across humans and AI agents

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/username/cli-template/main/install.sh | bash
```

This downloads the CLI and walks you through an interactive wizard:

```
🚀 CLI Template Wizard

📦 Project Details

Project name (e.g., my-awesome-cli): my-tool
Description: A tool that does useful things
Author name: Your Name
GitHub username: yourusername

📄 License
  → 1. MIT - Simple and permissive
    2. Apache 2.0 - Permissive with patent grant
    3. ISC - Simplified MIT

🛠️  Features

Include Docker support? [Y/n]: y
Include GitHub Actions CI? [Y/n]: y
Include release workflow? [Y/n]: y

✓ Project created successfully!

Next steps:
  1. cd my-tool
  2. make install
  3. make dev
```

### Alternative Installation

```bash
# Clone and run with Bun
git clone https://github.com/username/cli-template.git
cd cli-template
bun install
bun run src/cli.ts

# Or use the install script with Bun (no binary download)
CLI_TEMPLATE_USE_BUN=true curl -fsSL https://raw.githubusercontent.com/username/cli-template/main/install.sh | bash
```

## Generated Project

Your new CLI project includes:

```
my-tool/
├── src/
│   ├── cli.ts              # Entry point
│   └── utils/              # Colors, errors, logging
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

### Commands

Every generated project uses the same Makefile interface:

```bash
make install      # Install dependencies
make dev          # Run CLI in development mode
make check        # Run typecheck + lint + oxlint
make test         # Run tests
make build        # Build TypeScript to dist/
make build-binary # Build native binary
```

## Tooling

### Bun

**What**: JavaScript/TypeScript runtime and package manager.

**Why**: 4x faster than Node.js, built-in TypeScript support, fast package installs, native binary compilation.

```bash
bun install          # Install deps (replaces npm install)
bun run src/cli.ts   # Run TypeScript directly
bun test             # Run tests
bun build --compile  # Create native binary
```

### Biome

**What**: Linter and formatter in one tool.

**Why**: Replaces ESLint + Prettier with a single, faster tool. Written in Rust, 25x faster than ESLint.

```bash
make lint        # Check for issues
make lint-fix    # Auto-fix issues
make format      # Format all files
```

### Oxlint (with Type-Aware Rules)

**What**: Supplementary linter with TypeScript type-aware rules.

**Why**: Catches issues Biome misses, including critical async/promise bugs. Written in Rust, extremely fast. Type-aware rules catch:
- Floating promises (async calls without `await`)
- Misused promises in conditionals
- Unsafe type assertions
- Switch exhaustiveness violations

```bash
make oxlint      # Run oxlint with type-aware rules
```

### Zod

**What**: TypeScript-first schema validation library.

**Why**: Runtime type validation that infers TypeScript types. Single source of truth for CLI options - no more manual parsing with type mismatches.

```typescript
const CliOptions = z.object({
  output: z.string().optional(),
  verbose: z.boolean().default(false),
});
type CliOptions = z.infer<typeof CliOptions>; // Types auto-generated
```

### neverthrow

**What**: Type-safe error handling without exceptions.

**Why**: Makes error paths explicit in type signatures. Errors become compile-time checked, not runtime surprises. Forces handling of all error cases.

```typescript
import { ok, err, Result } from 'neverthrow';

function parseConfig(input: string): Result<Config, ParseError> {
  if (!input) return err(new ParseError('Empty input'));
  return ok(JSON.parse(input));
}
```

### publint + attw

**What**: Package validation tools.

**Why**: Catches export map issues and TypeScript declaration problems before users find them.

- **publint**: Validates package.json exports are correct
- **attw** (Are The Types Wrong?): Validates TypeScript declarations are resolvable

```bash
make check-exports   # Run both validators
```

### @tsconfig/strictest

**What**: Community-maintained strictest TypeScript configuration base.

**Why**: Extends your tsconfig with maximum type safety settings. Gets you future strict flags automatically as TypeScript evolves.

### Lefthook

**What**: Git hooks manager.

**Why**: Runs checks automatically on commit/push. Faster than Husky, written in Go.

Configured hooks:
- **pre-commit**: Runs Biome + Oxlint on staged files
- **pre-push**: Runs typecheck + tests

### TypeScript (Strict Configuration)

**What**: Type checking for JavaScript with maximum strictness.

**Why**: Catches type errors at compile time. Configured with Bun-recommended strict settings:
- `noUncheckedIndexedAccess` - Forces handling `undefined` when accessing arrays/objects by index
- `noImplicitOverride` - Requires `override` keyword for method overrides
- `exactOptionalPropertyTypes` - Distinguishes between `undefined` and missing properties
- `verbatimModuleSyntax` - Enforces proper import/export type syntax

```bash
make typecheck   # Check types without emitting
make build       # Compile to dist/
```

### TypeDoc

**What**: API documentation generator for TypeScript.

**Why**: Automatically generates HTML documentation from JSDoc comments. Essential for maintaining documentation in growing projects.

```bash
make docs        # Generate API docs to docs/ folder
make docs-serve  # Serve docs locally at http://localhost:8080
```

### Trivy

**What**: Comprehensive security scanner.

**Why**: Scans for vulnerabilities in dependencies, secrets in code, and misconfigurations. Critical for production-ready software.

```bash
make security    # Scan filesystem for vulnerabilities/secrets
make security-fix # Show detailed security report with fixes
make audit       # Run dependency audit
```

### Docker

**What**: Containerized development environment.

**Why**: Run commands without installing Bun locally. Consistent environment across machines.

```bash
make docker-test    # Run tests in container
make docker-lint    # Run linting in container
make docker-check   # Run all checks in container
make docker-shell   # Interactive shell
```

### GitHub Actions

**What**: CI/CD pipelines with caching and concurrency.

**Why**: Automated testing on every push, automatic binary releases on tags. Includes Bun dependency caching for faster CI runs and concurrency groups to cancel redundant workflow runs.

Included workflows:
- **ci.yml**: Typecheck, lint, test, security scan on every push/PR
- **release.yml**: Build binaries for macOS, Linux, Windows on tag push

### Dependabot

**What**: Automated dependency updates.

**Why**: Keeps dependencies secure and up-to-date without manual intervention. Creates PRs for:
- npm package updates (grouped by dev/prod)
- GitHub Actions updates
- Docker base image updates

Configuration: `.github/dependabot.yml`

## Development

```bash
# Clone this repo
git clone https://github.com/username/cli-template.git
cd cli-template

# Install dependencies
make install

# Run checks
make check

# Run tests
make test

# Test the wizard
bun run src/cli.ts --help
```

## Release

Generated projects include a release workflow:

```bash
make bump-patch     # 0.1.0 → 0.1.1
make bump-minor     # 0.1.0 → 0.2.0  
make bump-major     # 0.1.0 → 1.0.0
make release        # Create GitHub release with binaries
```

Binaries are built for:
- macOS (Apple Silicon + Intel)
- Linux (x64 + ARM64)
- Windows (x64)

## License

MIT
