# Bakery Plugin Authoring Guide

This guide explains how to create plugins for Bakery to add custom archetypes, addons, and templates.

## Overview

Bakery plugins can provide:

- **Archetypes** - Complete project templates (e.g., a new "Electron App" archetype)
- **Addons** - Optional features that enhance existing archetypes (e.g., "Sentry integration")
- **Templates** - Reusable file templates
- **Hooks** - Custom logic during project generation
- **Prompts** - Additional wizard questions

## Plugin Structure

A minimal plugin has this structure:

```
my-plugin/
├── plugin.json         # Required: plugin manifest
├── templates/          # Optional: template directories
│   └── my-addon/
│       ├── template.json
│       └── files/
└── index.ts            # Optional: hooks and prompts
```

## Plugin Manifest

Every plugin needs a `plugin.json` file:

```json
{
  "name": "bakery-plugin-sentry",
  "displayName": "Sentry Integration",
  "description": "Adds Sentry error tracking to your project",
  "version": "1.0.0",
  "author": "Your Name",
  "homepage": "https://github.com/you/bakery-plugin-sentry",
  "bakeryVersion": ">=1.0.0",
  "templates": ["./templates/sentry-addon"],
  "archetypes": [],
  "addons": ["./templates/sentry-addon"],
  "keywords": ["sentry", "error-tracking", "monitoring"],
  "dependencies": []
}
```

### Manifest Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (kebab-case, should start with `bakery-plugin-`) |
| `displayName` | Yes | Human-readable name shown in UI |
| `description` | Yes | Brief description of the plugin |
| `version` | Yes | Semantic version (e.g., `1.0.0`) |
| `author` | No | Author name or organization |
| `homepage` | No | URL to plugin repository |
| `bakeryVersion` | No | Minimum Bakery version required |
| `templates` | No | Paths to template directories |
| `archetypes` | No | Paths to archetype directories |
| `addons` | No | Paths to addon directories |
| `keywords` | No | Search keywords |
| `dependencies` | No | Other plugins this depends on |

## Creating Templates

Templates are directories with a `template.json` manifest and a `files/` directory.

### Template Manifest

```json
{
  "name": "sentry-addon",
  "displayName": "Sentry",
  "description": "Error tracking with Sentry",
  "type": "addon",
  "compatibleWith": ["cli", "api", "full-stack"],
  "dependencies": {
    "@sentry/bun": "^8.0.0"
  },
  "devDependencies": {},
  "scripts": {},
  "variables": {
    "sentryDsn": {
      "prompt": "Enter your Sentry DSN",
      "default": ""
    }
  }
}
```

### Template Types

- `archetype` - Complete project scaffolds
- `addon` - Optional add-ons for existing archetypes
- `partial` - Reusable file snippets

### Template Files

Files in the `files/` directory are copied to the output, with EJS template processing.

```
templates/sentry-addon/
├── template.json
└── files/
    ├── src/
    │   └── lib/
    │       └── sentry.ts.ejs
    └── .env.example.ejs
```

### EJS Template Variables

Templates have access to these variables:

```typescript
{
  // Project configuration
  projectName: string;      // kebab-case project name
  description: string;
  author: string;
  license: string;
  githubUsername: string;
  archetype: string;        // Selected archetype
  apiFramework?: string;    // hono, express, elysia
  webFramework?: string;    // react, next, vue, tanstack-start
  addons: string[];         // Selected addon IDs

  // Helper values
  projectNamePascal: string;  // PascalCase
  projectNameCamel: string;   // camelCase
  year: number;

  // Custom options from prompts
  customOptions?: Record<string, unknown>;
}
```

### Example Template File

`files/src/lib/sentry.ts.ejs`:

```typescript
import * as Sentry from '@sentry/bun';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
});

export { Sentry };
```

## Adding Hooks

Hooks let you run custom logic during generation. Create an `index.ts` that exports a `BakeryPlugin`:

```typescript
import type { BakeryPlugin, PluginContext } from 'bakery/plugins';

const plugin: BakeryPlugin = {
  name: 'bakery-plugin-sentry',
  version: '1.0.0',

  hooks: {
    // Called before generation starts
    beforeGenerate: async (ctx: PluginContext) => {
      ctx.logger.info('Setting up Sentry...');

      // Optionally modify config or skip generation
      return {
        configOverrides: {
          customOptions: {
            sentryEnabled: true,
          },
        },
      };
    },

    // Called after generation completes
    afterGenerate: async (ctx: PluginContext) => {
      return {
        // Add files not in templates
        additionalFiles: new Map([
          ['.sentryclirc', `[defaults]\norg=your-org\nproject=${ctx.config.projectName}`],
        ]),

        // Run commands after generation
        commands: [
          {
            command: 'bunx',
            args: ['@sentry/wizard', '-i', 'bun'],
            description: 'Configuring Sentry',
          },
        ],
      };
    },

    // Called if an error occurs
    onError: async (error, ctx) => {
      ctx.logger?.error(`Plugin error: ${error.message}`);
    },
  },
};

export default plugin;
```

### Hook Return Types

**beforeGenerate** can return:
```typescript
{
  skipGeneration?: boolean;        // Skip default generation
  additionalTemplates?: Template[]; // Add more templates
  configOverrides?: Partial<ProjectConfig>; // Modify config
}
```

**afterGenerate** can return:
```typescript
{
  additionalFiles?: Map<string, string>; // path -> content
  removeFiles?: string[];                 // Files to delete
  commands?: Array<{
    command: string;
    args?: string[];
    cwd?: string;          // Relative to output
    description?: string;
  }>;
}
```

## Adding Custom Prompts

Add questions to the wizard with the `prompts` array:

```typescript
const plugin: BakeryPlugin = {
  name: 'bakery-plugin-database',
  version: '1.0.0',

  prompts: [
    {
      name: 'databaseType',
      type: 'select',
      message: 'Which database do you want to use?',
      options: [
        { value: 'postgresql', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
        { value: 'sqlite', label: 'SQLite' },
      ],
      when: (config) => config.archetype === 'api',
    },
    {
      name: 'useORM',
      type: 'confirm',
      message: 'Include Drizzle ORM?',
      default: true,
    },
    {
      name: 'connectionString',
      type: 'text',
      message: 'Database connection string:',
      validate: (value) =>
        value && value.length > 0 ? true : 'Connection string is required',
    },
  ],
};
```

### Prompt Types

| Type | Description |
|------|-------------|
| `text` | Free-form text input |
| `select` | Single choice from options |
| `multiselect` | Multiple choices from options |
| `confirm` | Yes/no boolean |

### Prompt Options

```typescript
{
  name: string;              // Unique identifier
  type: 'text' | 'select' | 'multiselect' | 'confirm';
  message: string;           // Question shown to user
  default?: unknown;         // Default value
  options?: Array<{          // For select/multiselect
    value: string;
    label: string;
  }>;
  when?: (config) => boolean; // Show conditionally
  validate?: (value) => string | true; // Validation
}
```

## Plugin Context

The `PluginContext` provides utilities for plugins:

```typescript
interface PluginContext {
  // Project configuration from wizard
  config: ProjectConfig;

  // Output directory path
  outputDir: string;

  // All templates being used
  templates: LoadedTemplate[];

  // Logging
  logger: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
  };

  // File system utilities
  fs: {
    exists(path: string): boolean;
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    copy(src: string, dest: string): void;
    readDir(path: string): string[];
    mkdir(path: string): void;
  };

  // Template rendering
  template: {
    render(template: string, data?: object): string;
    renderFile(path: string, data?: object): string;
    getContext(): TemplateContext;
  };

  // State for plugin communication
  getState<T>(key: string): T | undefined;
  setState<T>(key: string, value: T): void;
}
```

## Installing Your Plugin

### Local Development

Put your plugin in `./bakery-plugins/` in any project:

```
my-project/
├── bakery-plugins/
│   └── my-plugin/
│       ├── plugin.json
│       └── ...
└── ...
```

### User-Wide Installation

Put plugins in `~/.bakery/plugins/`:

```
~/.bakery/plugins/
└── my-plugin/
    ├── plugin.json
    └── ...
```

### npm Package

Publish as an npm package with name starting with `bakery-plugin-`:

```json
{
  "name": "bakery-plugin-sentry",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bakery": {
    "templates": ["./templates/sentry-addon"],
    "addons": ["./templates/sentry-addon"]
  }
}
```

Install in a project:

```bash
bun add bakery-plugin-sentry
```

## Testing Plugins

Create a test project to verify your plugin:

```typescript
import { describe, expect, it } from 'bun:test';
import { loadPlugin } from 'bakery/plugins';
import * as path from 'path';

describe('My Plugin', () => {
  it('should load successfully', async () => {
    const pluginDir = path.join(__dirname, '..');
    const plugin = await loadPlugin(pluginDir);

    expect(plugin).not.toBeNull();
    expect(plugin?.manifest.name).toBe('bakery-plugin-sentry');
  });

  it('should provide templates', async () => {
    const plugin = await loadPlugin(path.join(__dirname, '..'));
    expect(plugin?.templates.length).toBeGreaterThan(0);
  });
});
```

## Best Practices

1. **Name plugins clearly** - Use `bakery-plugin-` prefix and descriptive names
2. **Document everything** - Include README with usage examples
3. **Test thoroughly** - Verify templates generate valid code
4. **Handle errors gracefully** - Use try/catch in hooks
5. **Keep it focused** - One plugin, one purpose
6. **Version carefully** - Use semantic versioning

## Example: Complete Plugin

Here's a complete example of a Tailwind CSS plugin:

**plugin.json**:
```json
{
  "name": "bakery-plugin-tailwind",
  "displayName": "Tailwind CSS",
  "description": "Adds Tailwind CSS to web projects",
  "version": "1.0.0",
  "addons": ["./templates/tailwind"]
}
```

**templates/tailwind/template.json**:
```json
{
  "name": "tailwind",
  "displayName": "Tailwind CSS",
  "description": "Utility-first CSS framework",
  "type": "addon",
  "compatibleWith": ["full-stack"],
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**templates/tailwind/files/tailwind.config.js.ejs**:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**index.ts**:
```typescript
import type { BakeryPlugin } from 'bakery/plugins';

const plugin: BakeryPlugin = {
  name: 'bakery-plugin-tailwind',
  version: '1.0.0',
  displayName: 'Tailwind CSS',
  description: 'Adds Tailwind CSS to web projects',

  hooks: {
    afterGenerate: async (ctx) => {
      if (!ctx.config.addons.includes('tailwind')) return;

      return {
        commands: [
          {
            command: 'bunx',
            args: ['tailwindcss', 'init', '-p'],
            description: 'Initializing Tailwind CSS',
          },
        ],
      };
    },
  },
};

export default plugin;
```
