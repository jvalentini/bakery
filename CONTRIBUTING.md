# Contributing to Bakery

Thank you for your interest in contributing to Bakery! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/cli-template.git
   cd cli-template
   ```
3. Install dependencies:
   ```bash
   make install
   ```
4. Run the checks to ensure everything works:
   ```bash
   make check
   make test
   ```

## Development Workflow

### Running Locally

```bash
# Run the CLI wizard
bun run src/cli.ts

# Run with arguments
bun run src/cli.ts -o ./test-output
```

### Running Tests

```bash
# All tests
make test

# Specific test file
bun test tests/templates.test.ts

# Watch mode
bun test --watch
```

### Code Quality

Before committing, ensure your code passes all checks:

```bash
make check
```

This runs:
- TypeScript type checking (`bun run typecheck`)
- Biome linting and formatting (`bun run lint`)
- Oxlint type-aware rules (`bun run oxlint`)

Lefthook will automatically run these checks on commit and push.

## Project Structure

```
cli-template/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── wizard/             # Interactive wizard
│   ├── generator/          # Project generation
│   ├── templates/          # Template engine
│   └── plugins/            # Plugin system
├── templates/              # Built-in templates
│   ├── archetypes/         # Project archetypes
│   ├── frameworks/         # Framework-specific files
│   └── addons/             # Optional add-ons
├── tests/                  # Test files
└── docs/                   # Documentation
```

## Making Changes

### Adding a New Archetype

1. Create a directory in `templates/archetypes/your-archetype/`
2. Add a `template.json` manifest
3. Add files in `files/` directory
4. Add tests in `tests/`

### Adding a New Addon

1. Create a directory in `templates/addons/your-addon/`
2. Add a `template.json` with `"type": "addon"`
3. Specify `compatibleWith` archetypes
4. Add files in `files/` directory

### Adding a New Framework

1. Create framework files in `templates/frameworks/`
2. Update the wizard to include the option
3. Add integration tests

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or fixing tests
- `chore`: Build, tools, or auxiliary changes

### Examples

```bash
git commit -m "feat(templates): add Svelte framework option"
git commit -m "fix(generator): handle spaces in project names"
git commit -m "docs: update plugin authoring guide"
git commit -m "test: add integration tests for API archetype"
```

## Pull Request Process

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes and commit with conventional commits

3. Ensure all checks pass:
   ```bash
   make check
   make test
   ```

4. Push to your fork and create a PR

5. Fill out the PR template with:
   - Description of changes
   - Related issues
   - Testing performed

## Testing Guidelines

### Unit Tests

Test individual functions and modules:

```typescript
import { describe, expect, it } from 'bun:test';
import { parseProjectName } from '../src/utils';

describe('parseProjectName', () => {
  it('should convert to kebab-case', () => {
    expect(parseProjectName('My Project')).toBe('my-project');
  });
});
```

### Integration Tests

Test complete generation workflows:

```typescript
describe('CLI archetype', () => {
  it('should generate valid project', async () => {
    const result = await generateProject({
      archetype: 'cli',
      projectName: 'test-cli',
    });

    expect(fs.existsSync(path.join(result.outputDir, 'package.json'))).toBe(true);
  });
});
```

### Snapshot Tests

Verify generated file contents:

```typescript
it('should match package.json snapshot', async () => {
  const result = await generateProject({ archetype: 'cli' });
  const pkg = fs.readFileSync(path.join(result.outputDir, 'package.json'), 'utf-8');
  expect(pkg).toMatchSnapshot();
});
```

## Template Guidelines

### EJS Templates

- Use `.ejs` extension for processed files
- Access variables directly: `<%= projectName %>`
- Use conditionals for optional sections:
  ```ejs
  <% if (addons.includes('docker')) { %>
  # Docker support
  docker-compose up
  <% } %>
  ```

### File Naming

- Use exact names for static files: `Makefile`, `biome.json`
- Use `.ejs` for processed files: `package.json.ejs`
- Use kebab-case for most files: `my-component.tsx.ejs`

## Code Style

- TypeScript with strict mode
- Biome for formatting and linting
- No semicolons (Biome default)
- Single quotes for strings
- 2-space indentation

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas

Thank you for contributing!
