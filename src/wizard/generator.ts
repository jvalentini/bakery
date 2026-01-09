import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectConfig } from './prompts.js';

interface TemplateContext {
  projectName: string;
  projectNamePascal: string;
  description: string;
  author: string;
  license: string;
  githubUsername: string;
  githubUrl: string;
  year: number;
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function createContext(config: ProjectConfig): TemplateContext {
  const githubUrl = config.githubUsername
    ? `https://github.com/${config.githubUsername}/${config.projectName}`
    : '';

  return {
    projectName: config.projectName,
    projectNamePascal: toPascalCase(config.projectName),
    description: config.description,
    author: config.author,
    license: config.license,
    githubUsername: config.githubUsername,
    githubUrl,
    year: new Date().getFullYear(),
  };
}

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

function generatePackageJson(context: TemplateContext, config: ProjectConfig): string {
  const pkg = {
    name: context.projectName,
    version: '0.1.0',
    description: context.description,
    type: 'module',
    main: './dist/cli.js',
    bin: {
      [context.projectName]: './dist/cli.js',
    },
    files: ['dist/'],
    repository: context.githubUrl
      ? {
          type: 'git',
          url: `${context.githubUrl}.git`,
        }
      : undefined,
    homepage: context.githubUrl ? `${context.githubUrl}#readme` : undefined,
    bugs: context.githubUrl ? { url: `${context.githubUrl}/issues` } : undefined,
    scripts: {
      dev: 'bun run src/cli.ts',
      build: 'tsc',
      'build:binary': `bun build src/cli.ts --compile --outfile ${context.projectName}`,
      'build:darwin-arm64': `mkdir -p dist && bun build src/cli.ts --compile --target=bun-darwin-arm64 --outfile dist/${context.projectName}-darwin-arm64`,
      'build:darwin-x64': `mkdir -p dist && bun build src/cli.ts --compile --target=bun-darwin-x64 --outfile dist/${context.projectName}-darwin-x64`,
      'build:linux-x64': `mkdir -p dist && bun build src/cli.ts --compile --target=bun-linux-x64 --outfile dist/${context.projectName}-linux-x64`,
      'build:linux-arm64': `mkdir -p dist && bun build src/cli.ts --compile --target=bun-linux-arm64 --outfile dist/${context.projectName}-linux-arm64`,
      'build:windows-x64': `mkdir -p dist && bun build src/cli.ts --compile --target=bun-windows-x64 --outfile dist/${context.projectName}-windows-x64.exe`,
      'build:binaries':
        'bun run build:darwin-arm64 && bun run build:darwin-x64 && bun run build:linux-x64 && bun run build:linux-arm64 && bun run build:windows-x64',
      test: 'bun test',
      'test:watch': 'bun test --watch',
      'test:coverage': 'bun test --coverage',
      lint: 'biome check .',
      'lint:fix': 'biome check --write .',
      format: 'biome format --write .',
      oxlint: 'oxlint .',
      typecheck: 'tsc --noEmit',
      check: 'bun run typecheck && bun run lint && bun run oxlint',
      'check:all': 'bun run check && bun run test:coverage',
      ...(config.includeDocs && {
        docs: 'typedoc',
        'docs:watch': 'typedoc --watch',
      }),
      ...(config.includePackageValidation && {
        'check:exports': 'bunx publint && bunx attw --pack',
        publint: 'bunx publint',
        attw: 'bunx attw --pack',
      }),
    },
    keywords: ['cli', 'typescript', 'bun'],
    author: context.author,
    license: context.license,
    engines: {
      bun: '>=1.0.0',
    },
    dependencies: {
      ...(config.includeZod && {
        zod: '^3.24.0',
      }),
      ...(config.includeNeverthrow && {
        neverthrow: '^8.2.0',
      }),
    },
    devDependencies: {
      '@biomejs/biome': '^2.3.11',
      '@types/node': '^20.0.0',
      'bun-types': 'latest',
      lefthook: '^2.0.13',
      oxlint: '^1.38.0',
      typescript: '^5.0.0',
      ...(config.includeStrictestConfig && {
        '@tsconfig/strictest': '^2.0.0',
      }),
      ...(config.includeDocs && {
        typedoc: '^0.27.0',
      }),
      ...(config.includePackageValidation && {
        publint: '^0.3.0',
        '@arethetypeswrong/cli': '^0.18.0',
      }),
    },
  };

  // Filter out empty objects for cleaner JSON output
  const cleanPkg = Object.fromEntries(
    Object.entries(pkg).filter(([_, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return Object.keys(value).length > 0;
      }
      return true;
    })
  );

  return `${JSON.stringify(cleanPkg, null, 2)}\n`;
}

function generateCliTs(context: TemplateContext): string {
  return `#!/usr/bin/env bun

import { error, green } from './utils/colors.js';
import { ArgumentError } from './utils/errors.js';

const VERSION = '0.1.0';

interface CliOptions {
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
}

function printHelp(): void {
  console.log(\`
${context.projectName} v\${VERSION}
${context.description}

USAGE:
  ${context.projectName} [options] <command>

COMMANDS:
  hello              Print a greeting message
  version            Show version number

OPTIONS:
  -v, --verbose      Show detailed output
  -q, --quiet        Suppress all output except errors
  --debug            Show debug information
  -h, --help         Show this help message
  --version          Show version number

EXAMPLES:
  ${context.projectName} hello
  ${context.projectName} hello --verbose
  ${context.projectName} --help
\`);
}

function parseArgs(args: string[]): { command?: string; options: CliOptions } {
  const options: CliOptions = {};
  let command: string | undefined;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      case '--version':
        console.log(VERSION);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          throw new ArgumentError(\`Unknown option: \${arg}\`);
        }
        if (!command) {
          command = arg;
        }
    }
    i++;
  }

  return { command, options };
}

function runHello(options: CliOptions): void {
  if (options.verbose) {
    console.log('Running hello command...');
  }

  console.log(green('Hello from ${context.projectName}!'));

  if (options.verbose) {
    console.log('Command completed successfully.');
  }
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      printHelp();
      process.exit(0);
    }

    const { command, options } = parseArgs(args);

    if (options.debug) {
      console.log('Debug mode enabled');
      console.log('Command:', command);
      console.log('Options:', JSON.stringify(options));
    }

    switch (command) {
      case 'hello':
        runHello(options);
        break;
      case 'version':
        console.log(VERSION);
        break;
      default:
        if (command) {
          throw new ArgumentError(\`Unknown command: \${command}\`);
        }
        printHelp();
    }
  } catch (err) {
    if (err instanceof ArgumentError) {
      console.error(error(err.message));
      console.error('Run "${context.projectName} --help" for usage information');
      process.exit(1);
    }

    console.error(error(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

main();
`;
}

function generateColorsTs(): string {
  return `const isColorSupported =
  process.env.FORCE_COLOR !== '0' &&
  (process.env.FORCE_COLOR === '1' ||
    process.env.COLORTERM !== undefined ||
    (process.stdout.isTTY && process.env.TERM !== 'dumb'));

function colorize(code: number, text: string): string {
  if (!isColorSupported) return text;
  return \`\\x1b[\${code}m\${text}\\x1b[0m\`;
}

export function red(text: string): string {
  return colorize(31, text);
}

export function green(text: string): string {
  return colorize(32, text);
}

export function yellow(text: string): string {
  return colorize(33, text);
}

export function blue(text: string): string {
  return colorize(34, text);
}

export function magenta(text: string): string {
  return colorize(35, text);
}

export function cyan(text: string): string {
  return colorize(36, text);
}

export function dim(text: string): string {
  return colorize(2, text);
}

export function bold(text: string): string {
  return colorize(1, text);
}

export function error(text: string): string {
  return red(\`error: \${text}\`);
}

export function warning(text: string): string {
  return yellow(\`warning: \${text}\`);
}

export function success(text: string): string {
  return green(\`success: \${text}\`);
}

export function info(text: string): string {
  return blue(\`info: \${text}\`);
}
`;
}

function generateErrorsTs(): string {
  return `export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export class ArgumentError extends CliError {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
}

export class FileNotFoundError extends CliError {
  constructor(public readonly filepath: string) {
    super(\`File not found: \${filepath}\`);
    this.name = 'FileNotFoundError';
  }
}

export class FileReadError extends CliError {
  constructor(
    public readonly filepath: string,
    cause?: Error
  ) {
    super(\`Failed to read file: \${filepath}\${cause ? \` - \${cause.message}\` : ''}\`);
    this.name = 'FileReadError';
  }
}

export class FileWriteError extends CliError {
  constructor(
    public readonly filepath: string,
    cause?: Error
  ) {
    super(\`Failed to write file: \${filepath}\${cause ? \` - \${cause.message}\` : ''}\`);
    this.name = 'FileWriteError';
  }
}
`;
}

function generateLoggerTs(): string {
  return `import { blue, dim, red, yellow } from './colors.js';

interface LoggerConfig {
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

let config: LoggerConfig = {};

export const Logger = {
  configure(options: LoggerConfig): void {
    config = { ...options };
  },

  info(message: string, ...args: unknown[]): void {
    if (config.quiet) return;
    console.error(blue('info:'), message, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    if (config.quiet) return;
    console.error(yellow('warn:'), message, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(red('error:'), message, ...args);
  },

  verbose(message: string, ...args: unknown[]): void {
    if (!config.verbose || config.quiet) return;
    console.error(dim('verbose:'), message, ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (!config.debug) return;
    console.error(dim('debug:'), message, ...args);
  },

  log(message: string, ...args: unknown[]): void {
    if (config.quiet) return;
    console.log(message, ...args);
  },
};
`;
}

function generateTsConfig(config: ProjectConfig): string {
  if (config.includeStrictestConfig) {
    return `{
  "extends": "@tsconfig/strictest/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "allowJs": true,

    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "moduleDetection": "force",
    "isolatedModules": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
`;
  }

  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
`;
}

function generateBiomeJson(): string {
  return `{
  "$schema": "https://biomejs.dev/schemas/2.3.11/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "includes": ["**", "!**/node_modules", "!**/dist", "!**/coverage", "!**/*.lock", "!**/*.log"]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 100,
    "attributePosition": "auto"
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "noParameterAssign": "error",
        "useConst": "error",
        "useTemplate": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noArrayIndexKey": "warn",
        "noDoubleEquals": "error"
      },
      "complexity": {
        "noForEach": "off",
        "useSimplifiedLogicExpression": "warn",
        "useLiteralKeys": "off"
      },
      "performance": {
        "noDelete": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "trailingCommas": "es5",
      "semicolons": "always",
      "arrowParentheses": "always",
      "bracketSpacing": true,
      "bracketSameLine": false,
      "quoteProperties": "asNeeded"
    }
  },
  "json": {
    "formatter": {
      "enabled": true
    }
  }
}
`;
}

function generateOxlintJson(): string {
  return `{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "rules": {
    "typescript/await-thenable": "error",
    "typescript/no-array-delete": "error",
    "typescript/no-base-to-string": "error",
    "typescript/no-confusing-void-expression": "error",
    "typescript/no-duplicate-type-constituents": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-for-in-array": "error",
    "typescript/no-implied-eval": "error",
    "typescript/no-meaningless-void-operator": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-misused-spread": "error",
    "typescript/no-mixed-enums": "error",
    "typescript/no-redundant-type-constituents": "error",
    "typescript/no-unnecessary-boolean-literal-compare": "error",
    "typescript/no-unnecessary-template-expression": "error",
    "typescript/no-unnecessary-type-arguments": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-enum-comparison": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/no-unsafe-unary-minus": "error",
    "typescript/only-throw-error": "error",
    "typescript/prefer-promise-reject-errors": "error",
    "typescript/prefer-reduce-type-parameter": "error",
    "typescript/prefer-return-this-type": "error",
    "typescript/promise-function-async": "error",
    "typescript/require-array-sort-compare": "error",
    "typescript/require-await": "error",
    "typescript/restrict-plus-operands": "error",
    "typescript/restrict-template-expressions": "error",
    "typescript/return-await": "error",
    "typescript/switch-exhaustiveness-check": "error",
    "typescript/use-unknown-in-catch-callback-variable": "error"
  },
  "ignorePatterns": ["node_modules", "dist", "coverage"]
}
`;
}

function generateDependabotYml(): string {
  return `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "UTC"
    open-pull-requests-limit: 10
    groups:
      dev-dependencies:
        patterns:
          - "@biomejs/*"
          - "@types/*"
          - "@commitlint/*"
          - "bun-types"
          - "knip"
          - "lefthook"
          - "oxlint"
          - "typedoc"
          - "typescript"
        update-types:
          - "minor"
          - "patch"
      production-dependencies:
        patterns:
          - "zod"
          - "neverthrow"
        update-types:
          - "minor"
          - "patch"
    commit-message:
      prefix: "deps"
      include: "scope"
    labels:
      - "dependencies"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "UTC"
    open-pull-requests-limit: 5
    commit-message:
      prefix: "ci"
      include: "scope"
    labels:
      - "ci"
      - "dependencies"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "UTC"
    open-pull-requests-limit: 3
    commit-message:
      prefix: "docker"
      include: "scope"
    labels:
      - "docker"
      - "dependencies"
`;
}

function generateLefthookYml(): string {
  return `pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,json}"
      run: bunx biome check --no-errors-on-unmatched {staged_files}
      stage_fixed: true

    oxlint:
      glob: "*.ts"
      run: bunx oxlint {staged_files}

pre-push:
  commands:
    typecheck:
      glob: "*.ts"
      run: bunx tsc --noEmit

    test:
      glob: "*.ts"
      run: bun test
`;
}

function generateKnipJson(): string {
  return `{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/cli.ts"],
  "project": ["src/**/*.ts"],
  "ignore": ["**/*.test.ts", "**/*.spec.ts"],
  "ignoreDependencies": ["oxlint", "bun-types", "@commitlint/cli", "@commitlint/config-conventional"],
  "ignoreExportsUsedInFile": true
}
`;
}

function generateCommitlintConfig(): string {
  return `export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [0, 'never'],
  },
};
`;
}

function generateEditorConfig(): string {
  return `# EditorConfig is awesome: https://EditorConfig.org

# top-most EditorConfig file
root = true

# All files
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

# Markdown files
[*.md]
trim_trailing_whitespace = false

# YAML files
[*.{yml,yaml}]
indent_size = 2

# JSON files
[*.json]
indent_size = 2

# Package files
[{package.json,bun.lock*}]
indent_size = 2

# Makefile
[Makefile]
indent_style = tab

# Shell scripts
[*.{sh,bash}]
indent_size = 2

# Git commit messages
[.git/COMMIT_EDITMSG]
max_line_length = 72
`;
}

function generateGitignore(context: TemplateContext): string {
  return `node_modules/
dist/
coverage/
*.log
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
*.swo
bun.lockb
${context.projectName}-*
!src/**
`;
}

function generateMakefile(context: TemplateContext, _config: ProjectConfig): string {
  return `VERSION := $(shell node -p "require('./package.json').version")
BUILD_DATE := $(shell date -u +'%Y-%m-%dT%H:%M:%SZ')
VCS_REF := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "=========================================="
	@echo "${context.projectName} - Commands"
	@echo "=========================================="
	@echo ""
	@echo "SETUP:"
	@echo "  make install        - Install dependencies"
	@echo ""
	@echo "DEVELOPMENT:"
	@echo "  make dev            - Run CLI in development mode"
	@echo ""
	@echo "LINTING:"
	@echo "  make lint           - Run biome + oxlint + knip with auto-fix"
	@echo "  make type-check     - Run TypeScript type checking"
	@echo ""
	@echo "TESTING:"
	@echo "  make test           - Run tests"
	@echo "  make test-watch     - Watch mode"
	@echo "  make test-coverage  - With coverage"
	@echo ""
	@echo "DOCUMENTATION:"
	@echo "  make docs           - Generate API documentation"
	@echo "  make docs-watch     - Generate docs in watch mode"
	@echo "  make docs-serve     - Serve docs locally"
	@echo ""
	@echo "SECURITY:"
	@echo "  make security       - Run security scan (Trivy)"
	@echo "  make security-fix   - Show security fixes"
	@echo "  make audit          - Run npm audit"
	@echo ""
	@echo "BUILD:"
	@echo "  make build          - Build to dist/"
	@echo "  make build-binary   - Build native binary"
	@echo "  make build-all      - Build all platforms"

.PHONY: install
install:
	@bun install

.PHONY: dev
dev:
	@bun run src/cli.ts --help

.PHONY: lint
lint:
	@bun run lint:fix
	@bunx oxlint --fix .
	@echo ""
	@echo "Checking for unused code..."
	@-bunx knip --no-exit-code

.PHONY: lint-fix
lint-fix:
	@bun run lint:fix
	@bun run oxlint

.PHONY: lint-fix-all
lint-fix-all:
	@bun run lint:fix --unsafe
	@bun run oxlint

.PHONY: format
format:
	@bun run format

.PHONY: oxlint
oxlint:
	@bun run oxlint

.PHONY: typecheck
typecheck:
	@bun run typecheck

.PHONY: check
check:
	@bun run check

.PHONY: test
test:
	@bun test

.PHONY: test-watch
test-watch:
	@bun test --watch

.PHONY: test-coverage
test-coverage:
	@bun test --coverage

.PHONY: docs
docs:
	@echo "Generating API documentation..."
	@bunx typedoc
	@echo "Documentation generated in docs/"

.PHONY: docs-watch
docs-watch:
	@bun run docs:watch

.PHONY: docs-serve
docs-serve:
	@cd docs && python3 -m http.server 8080

.PHONY: security
security:
	@echo "Scanning for vulnerabilities..."
	@mise exec -- trivy fs --config trivy.yaml --scanners vuln --severity HIGH,CRITICAL .

.PHONY: security-fix
security-fix:
	@command -v trivy >/dev/null 2>&1 || { echo "Trivy not installed. Install: brew install trivy"; exit 1; }
	@trivy fs --config trivy.yaml --format table .

.PHONY: audit
audit:
	@bun pm audit 2>/dev/null || echo "No audit available for bun, checking with npm..."
	@npm audit --audit-level=moderate 2>/dev/null || true

.PHONY: build
build:
	@bun run build

.PHONY: build-binary
build-binary:
	@bun build src/cli.ts --compile --outfile ${context.projectName}

.PHONY: build-all
build-all:
	@bun run build:binaries

.PHONY: clean
clean:
	@rm -rf node_modules dist coverage docs bun.lockb ${context.projectName}-*

.PHONY: version
version:
	@echo "Version: $(VERSION)"
`;
}

function generateReadme(context: TemplateContext, _config: ProjectConfig): string {
  return `# ${context.projectName}

${context.description}

## Installation

\`\`\`bash
bun install
\`\`\`

## Usage

\`\`\`bash
# Run in development
bun run src/cli.ts --help

# Or use make
make dev
\`\`\`

## Development

\`\`\`bash
make install     # Install dependencies
make check       # Run all checks
make test        # Run tests
make build       # Build to dist/
\`\`\`

## Documentation

\`\`\`bash
make docs        # Generate API docs
make docs-serve  # Serve docs locally
\`\`\`

## Security

\`\`\`bash
make security    # Scan for vulnerabilities
make audit       # Audit dependencies
\`\`\`

## License

${context.license}${context.author ? ` - ${context.author}` : ''}
`;
}

function generateCliTestTs(context: TemplateContext): string {
  return `import { describe, expect, it } from 'bun:test';
import { spawn } from 'node:child_process';

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'src/cli.ts', ...args], {
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

describe('CLI', () => {
  it('should show help when no arguments provided', async () => {
    const { stdout, exitCode } = await runCli([]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('USAGE:');
    expect(stdout).toContain('${context.projectName}');
  });

  it('should show help with --help flag', async () => {
    const { stdout, exitCode } = await runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('USAGE:');
  });

  it('should show version with --version flag', async () => {
    const { stdout, exitCode } = await runCli(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\\d+\\.\\d+\\.\\d+$/);
  });

  it('should run hello command', async () => {
    const { stdout, exitCode } = await runCli(['hello']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Hello');
  });

  it('should fail with unknown option', async () => {
    const { stderr, exitCode } = await runCli(['--unknown']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown option');
  });

  it('should fail with unknown command', async () => {
    const { stderr, exitCode } = await runCli(['unknown-command']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown command');
  });
});
`;
}

function generateCiYml(_context: TemplateContext): string {
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

env:
  COVERAGE_THRESHOLD: 80

jobs:
  quality:
    name: Code Quality & Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bun run typecheck

      - name: Lint with Biome
        run: bun run lint

      - name: Lint with Oxlint
        run: bun run oxlint

      - name: Run tests
        run: bun test --coverage

  build:
    name: Build Check
    runs-on: ubuntu-latest
    needs: quality

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build

      - name: Verify CLI runs
        run: bun run src/cli.ts --help
`;
}

function generateReleaseYml(context: TemplateContext): string {
  return `name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    name: Build \${{ matrix.target }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target:
          - darwin-arm64
          - darwin-x64
          - linux-x64
          - linux-arm64
          - windows-x64

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build for \${{ matrix.target }}
        run: bun run build:\${{ matrix.target }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${context.projectName}-\${{ matrix.target }}
          path: dist/${context.projectName}-\${{ matrix.target }}*

  release:
    name: Create Release
    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: dist

      - name: Prepare release assets
        run: |
          mkdir -p release
          for dir in dist/${context.projectName}-*; do
            cp "$dir/"* release/
          done
          chmod +x release/${context.projectName}-* || true
          ls -la release/

      - name: Create checksums
        run: |
          cd release
          sha256sum ${context.projectName}-* > checksums.txt
          cat checksums.txt

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: |
            release/${context.projectName}-*
            release/checksums.txt
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
}

function generateDockerfile(_context: TemplateContext): string {
  return `FROM oven/bun:1.3-alpine AS base

WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["bun", "run", "dev"]

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["bun", "test"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS production
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
ENTRYPOINT ["bun", "run", "dist/cli.js"]
`;
}

function generateDockerCompose(_context: TemplateContext): string {
  return `services:
  dev:
    build:
      context: .
      target: dev
    volumes:
      - .:/app
      - /app/node_modules
    command: bun run dev

  test:
    build:
      context: .
      target: test
    volumes:
      - .:/app
      - /app/node_modules
    command: bun test

  lint:
    build:
      context: .
      target: dev
    volumes:
      - .:/app
      - /app/node_modules
    command: bun run lint

  check:
    build:
      context: .
      target: dev
    volumes:
      - .:/app
      - /app/node_modules
    command: bun run check

  shell:
    build:
      context: .
      target: dev
    volumes:
      - .:/app
      - /app/node_modules
    command: /bin/sh
    stdin_open: true
    tty: true
`;
}

function generateDockerignore(): string {
  return `node_modules
dist
coverage
.git
.github
*.log
*.md
!README.md
.DS_Store
`;
}

function generateTypedocJson(context: TemplateContext): string {
  return `{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["src/cli.ts"],
  "out": "docs",
  "name": "${context.projectName}",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeProtected": true,
  "excludeInternal": true,
  "includeVersion": true,
  "navigationLinks": {
    "GitHub": "${context.githubUrl || `https://github.com/username/${context.projectName}`}"
  },
  "plugin": [],
  "theme": "default"
}
`;
}

function generateTrivyYaml(): string {
  return `severity:
  - CRITICAL
  - HIGH
  - MEDIUM

vulnerability:
  type:
    - os
    - library

scan:
  scanners:
    - vuln
    - secret
    - misconfig

secret:
  config: trivy-secret.yaml

exit:
  code: 1
  on-eol: 1
`;
}

function generateTrivySecretYaml(): string {
  return `rules:
  - id: generic-api-key
    category: general
    title: Generic API Key
    severity: HIGH
    regex: (?i)api[_-]?key\\s*[:=]\\s*['"]?[\\w-]{20,}['"]?

  - id: generic-secret
    category: general
    title: Generic Secret
    severity: HIGH
    regex: (?i)secret\\s*[:=]\\s*['"]?[\\w-]{20,}['"]?

  - id: private-key
    category: general
    title: Private Key
    severity: CRITICAL
    regex: -----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----

  - id: github-token
    category: general
    title: GitHub Token
    severity: CRITICAL
    regex: (?i)gh[pousr]_[A-Za-z0-9_]{36,}

  - id: npm-token
    category: general
    title: NPM Token
    severity: HIGH
    regex: npm_[A-Za-z0-9]{36}

allow-rules:
  - id: allow-example-keys
    description: Allow example/placeholder keys in documentation
    regex: (example|placeholder|your[-_]?key|xxx+|test[-_]?key)
`;
}

function generateAgentsMd(_context: TemplateContext, _config: ProjectConfig): string {
  return `# AI Agent Instructions

All commands use Makefile targets for consistency.

## Quick Reference

| Task | Command | Exit 0 = Success |
|------|---------|------------------|
| Install deps | \`make install\` | Yes |
| Run tests | \`make test\` | Yes |
| Type check | \`make typecheck\` | Yes |
| Lint code | \`make lint\` | Yes |
| Fix lint issues (safe) | \`make lint-fix\` | Yes |
| Fix lint issues (all) | \`make lint-fix-all\` | Yes |
| Format code | \`make format\` | Yes |
| All checks | \`make check\` | Yes |
| Build | \`make build\` | Yes |
| Generate docs | \`make docs\` | Yes |
| Security scan | \`make security\` | Yes |

## Workflow

### After Making Changes
\`\`\`bash
make check           # Run typecheck + lint + oxlint
make test            # Run test suite
\`\`\`

### Before Committing
\`\`\`bash
make lint-fix        # Auto-fix lint issues
make format          # Ensure consistent formatting
make check && make test
\`\`\`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Lint/type/test failure |
| 2 | File not found |
`;
}

export function generateProject(config: ProjectConfig, outputDir: string): void {
  const context = createContext(config);

  writeFile(path.join(outputDir, 'package.json'), generatePackageJson(context, config));
  if (config.includeDocs) {
    writeFile(path.join(outputDir, 'typedoc.json'), generateTypedocJson(context));
  }
  writeFile(path.join(outputDir, 'tsconfig.json'), generateTsConfig(config));
  writeFile(path.join(outputDir, 'oxlint.json'), generateOxlintJson());
  writeFile(path.join(outputDir, 'biome.json'), generateBiomeJson());
  writeFile(path.join(outputDir, 'lefthook.yml'), generateLefthookYml());
  writeFile(path.join(outputDir, '.editorconfig'), generateEditorConfig());
  writeFile(path.join(outputDir, '.gitignore'), generateGitignore(context));
  writeFile(path.join(outputDir, 'knip.json'), generateKnipJson());
  writeFile(path.join(outputDir, 'commitlint.config.js'), generateCommitlintConfig());
  writeFile(path.join(outputDir, 'Makefile'), generateMakefile(context, config));
  writeFile(path.join(outputDir, 'README.md'), generateReadme(context, config));
  writeFile(path.join(outputDir, 'AGENTS.md'), generateAgentsMd(context, config));
  if (config.includeSecurity) {
    writeFile(path.join(outputDir, 'trivy.yaml'), generateTrivyYaml());
    writeFile(path.join(outputDir, 'trivy-secret.yaml'), generateTrivySecretYaml());
  }

  writeFile(path.join(outputDir, 'src', 'cli.ts'), generateCliTs(context));
  writeFile(path.join(outputDir, 'src', 'utils', 'colors.ts'), generateColorsTs());
  writeFile(path.join(outputDir, 'src', 'utils', 'errors.ts'), generateErrorsTs());
  writeFile(path.join(outputDir, 'src', 'utils', 'logger.ts'), generateLoggerTs());

  writeFile(path.join(outputDir, 'tests', 'cli.test.ts'), generateCliTestTs(context));

  if (config.includeCi) {
    writeFile(path.join(outputDir, '.github', 'workflows', 'ci.yml'), generateCiYml(context));
  }

  if (config.includeReleaseWorkflow) {
    writeFile(
      path.join(outputDir, '.github', 'workflows', 'release.yml'),
      generateReleaseYml(context)
    );
  }

  if (config.includeDependabot) {
    writeFile(path.join(outputDir, '.github', 'dependabot.yml'), generateDependabotYml());
  }

  if (config.includeDocker) {
    writeFile(path.join(outputDir, 'Dockerfile'), generateDockerfile(context));
    writeFile(path.join(outputDir, 'docker-compose.yml'), generateDockerCompose(context));
    writeFile(path.join(outputDir, '.dockerignore'), generateDockerignore());
  }
}
