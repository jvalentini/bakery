# Bakery

Bake fresh projects from recipes - a modular project scaffolder with best-in-class tooling pre-configured.

## Why?

Starting a new project means hours of setup: configuring TypeScript, choosing a linter, setting up formatters, writing CI pipelines, configuring Docker, creating Makefiles. This tool eliminates that friction.

Run one command, answer a few questions, and get a production-ready project with modern tooling.

## Installation

### One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/jvalentini/cli-template/main/install.sh | bash
```

This downloads and runs the interactive wizard directly. No permanent installation required.

### Install globally

```bash
# With bun
bun install -g bakery

# With npm
npm install -g bakery
```

### From source

```bash
git clone https://github.com/jvalentini/cli-template.git
cd cli-template
make install
bun run src/cli.ts
```

## Quick Start

```bash
# Run the interactive wizard
bakery

# Or specify output directory
bakery -o ./my-project
```

## Archetypes

Bakery offers multiple project archetypes (recipes):

| Archetype | Description | Best For |
|-----------|-------------|----------|
| **CLI Tool** | Command-line applications | DevOps tools, utilities, automation |
| **REST API** | Backend with Hono/Express/Elysia | Web services, microservices |
| **Full-Stack** | Monorepo with API + Web | SaaS apps, dashboards |
| **Effect CLI/API** | Effect-ts patterns for backend/CLI | Type-safe, functional backend |
| **Effect Full-Stack** | Effect + Convex + TanStack Start | Real-time collaborative apps |

### CLI Tool

Perfect for command-line utilities, DevOps tools, and automation scripts.

```bash
bakery -o my-cli
# Select: CLI Tool
# Your CLI with binary compilation, version management, and help generation
```

**Includes**: Bun for native binary compilation, commander.js for CLI framework, automatic version flags.

### REST API

Backend services with your choice of framework.

```bash
bakery -o my-api
# Select: REST API
# Choose: Hono, Express, or Elysia
```

**Framework Options**:
- **Hono** - Lightweight, fast, great with Bun. Best for edge deployments.
- **Express** - Battle-tested, huge ecosystem. Best for complex enterprise apps.
- **Elysia** - Bun-native, TypeScript-first. Best for end-to-end type safety.

### Full-Stack

Monorepo with API backend and web frontend in coordinated packages.

```bash
bakery -o my-app
# Select: Full-Stack
# Choose API: Hono/Express/Elysia
# Choose Web: React/Next.js/Vue/TanStack Start
```

**Web Framework Options**:
- **React (Vite)** - Fast development, flexible architecture
- **Next.js** - SSR, API routes, great DX
- **Vue** - Progressive, gentle learning curve
- **TanStack Start** - Full-stack type safety, file-based routing

### Effect Archetypes

For projects using Effect-ts for robust, type-safe functional programming.

```bash
bakery -o my-effect-app
# Select: Effect CLI/API or Effect Full-Stack
```

**Effect Full-Stack** combines:
- Effect for type-safe business logic
- Convex for real-time database
- TanStack Start for the frontend

## Addons

Enhance any archetype with optional features:

| Addon | Description |
|-------|-------------|
| **Docker** | Dockerfile + docker-compose for containerized development |
| **GitHub Actions** | CI/CD pipelines, automated testing, binary releases |
| **Convex** | Real-time database with automatic sync |
| **TanStack Query** | Powerful data fetching and caching |
| **TanStack Router** | Type-safe routing for React |
| **TanStack Form** | Performant, type-safe forms |
| **TypeDoc** | API documentation generation |
| **Trivy** | Container security scanning |

## What Every Project Gets

All generated projects include:

- **TypeScript + Bun** - Fast development and execution
- **Biome + Oxlint** - Comprehensive linting and formatting
- **Lefthook** - Git hooks that catch issues before commit
- **Makefile** - Consistent commands for humans and AI agents

### Standard Commands

Every project uses the same Makefile interface:

```bash
make install      # Install dependencies
make dev          # Run in development mode
make check        # Run typecheck + lint + oxlint
make test         # Run tests
make build        # Build to dist/
make build-binary # Build native binary (CLI projects)
```

## Plugins

Bakery supports plugins for extending functionality with custom archetypes, addons, and templates.

### Installing Plugins

Plugins are loaded automatically from:

1. **Local project** - `./bakery-plugins/plugin-name/`
2. **User directory** - `~/.bakery/plugins/plugin-name/`
3. **npm packages** - `bakery-plugin-*` in node_modules

### Using Plugins

```bash
# List installed plugins
bakery plugins

# Plugins automatically add their archetypes/addons to the wizard
bakery
```

### Creating Plugins

See [docs/plugins.md](docs/plugins.md) for the complete plugin authoring guide.

A minimal plugin structure:

```
my-plugin/
├── plugin.json       # Plugin manifest
├── templates/
│   └── my-addon/
│       ├── template.json
│       └── files/
└── index.ts          # Optional: hooks and prompts
```

## Tooling Choices

### Why Bun?

4x faster than Node.js, built-in TypeScript support, fast package installs, native binary compilation.

### Why Biome?

Replaces ESLint + Prettier with a single, faster tool. Written in Rust, 25x faster than ESLint.

### Why Oxlint?

Supplementary linter with TypeScript type-aware rules. Catches async/promise bugs that Biome misses. Written in Rust, extremely fast.

### Why Lefthook?

Git hooks manager that runs checks automatically on commit/push. Faster than Husky, written in Go.

## Development

```bash
# Clone this repo
git clone https://github.com/jvalentini/cli-template.git
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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to Bakery.

## License

MIT
