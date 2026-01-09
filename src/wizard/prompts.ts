import { execSync } from 'node:child_process';
import * as readline from 'node:readline';
import { blue, bold, cyan, dim, green, red, yellow } from '../utils/colors.js';

/**
 * Archetype types
 */
export type Archetype = 'cli' | 'api' | 'full-stack' | 'effect-cli' | 'effect-full-stack';

/**
 * API framework choices
 */
export type ApiFramework = 'hono' | 'express' | 'elysia';

/**
 * Web framework choices
 */
export type WebFramework = 'react-vite' | 'nextjs' | 'vue' | 'tanstack-start';

/**
 * Available addons
 */
export type Addon =
  | 'docker'
  | 'ci'
  | 'release'
  | 'dependabot'
  | 'docs'
  | 'security'
  | 'zod'
  | 'neverthrow'
  | 'convex'
  | 'tanstack-query'
  | 'tanstack-router'
  | 'tanstack-form';

export interface ProjectConfig {
  // Core project info
  projectName: string;
  description: string;
  author: string;
  license: 'MIT' | 'Apache-2.0' | 'ISC' | 'GPL-3.0' | 'BSD-3-Clause';
  githubUsername: string;

  // Archetype selection
  archetype: Archetype;
  apiFramework: ApiFramework | undefined;
  webFramework: WebFramework | undefined;

  // Addons (replaces individual boolean flags)
  addons: Addon[];
}

/**
 * Legacy config for backward compatibility during migration
 */
export interface LegacyProjectConfig {
  projectName: string;
  description: string;
  author: string;
  license: 'MIT' | 'Apache-2.0' | 'ISC' | 'GPL-3.0' | 'BSD-3-Clause';
  githubUsername: string;
  includeDocker: boolean;
  includeCi: boolean;
  includeReleaseWorkflow: boolean;
  includeDocs: boolean;
  includeSecurity: boolean;
  includeDependabot: boolean;
  includeZod: boolean;
  includeNeverthrow: boolean;
  includePackageValidation: boolean;
  includeStrictestConfig: boolean;
}

let rl: readline.Interface | null = null;

function getReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
  }
  return rl;
}

function resetReadline(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const reader = getReadline();
    reader.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ANSI escape codes for terminal control
const ANSI = {
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine: '\x1b[2K',
  moveUp: (n: number) => `\x1b[${n}A`,
  moveToStart: '\r',
};

// Key codes
const KEYS = {
  up: '\x1b[A',
  down: '\x1b[B',
  enter: '\r',
  enterLF: '\n',
  space: ' ',
  ctrlC: '\x03',
  escape: '\x1b',
};

/**
 * Read a single keypress in raw mode
 */
function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.once('data', (data) => {
      stdin.setRawMode(wasRaw ?? false);
      // Don't pause - readline needs stdin to keep flowing
      resolve(data.toString());
    });
  });
}

/**
 * Render a selection list with the current cursor position
 */
function renderSelectList(
  options: { label: string }[],
  cursor: number,
  selected?: Set<number>
): void {
  const output = process.stderr;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt) continue;

    const isCursor = i === cursor;
    const isSelected = selected?.has(i);

    let marker: string;
    if (selected !== undefined) {
      // Multi-select mode
      marker = isSelected ? green('◉') : dim('○');
    } else {
      // Single-select mode
      marker = isCursor ? green('❯') : ' ';
    }

    const label = isCursor ? bold(opt.label) : opt.label;
    const prefix = isCursor ? cyan('›') : ' ';

    output.write(`${ANSI.clearLine}  ${prefix} ${marker} ${label}\n`);
  }
}

/**
 * Clear the rendered list and move cursor back up
 */
function clearList(lineCount: number): void {
  const output = process.stderr;
  output.write(ANSI.moveUp(lineCount));
  for (let i = 0; i < lineCount; i++) {
    output.write(`${ANSI.clearLine}\n`);
  }
  output.write(ANSI.moveUp(lineCount));
}

/**
 * Interactive single-select with arrow keys
 */
async function interactiveSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string }[],
  defaultIndex = 0
): Promise<T> {
  const output = process.stderr;
  let cursor = defaultIndex;

  output.write(`\n${prompt}\n`);
  output.write(dim('  (Use arrow keys to navigate, Enter to select)\n\n'));
  output.write(ANSI.hideCursor);

  renderSelectList(options, cursor);

  try {
    while (true) {
      const key = await readKey();

      if (key === KEYS.ctrlC) {
        output.write(ANSI.showCursor);
        process.exit(0);
      }

      if (key === KEYS.enter || key === KEYS.enterLF) {
        output.write(ANSI.showCursor);
        const selected = options[cursor];
        if (selected) {
          // Show what was selected
          clearList(options.length);
          output.write(`${ANSI.clearLine}  ${green('✓')} ${selected.label}\n`);
          // Reset readline so it's fresh for text input
          resetReadline();
          return selected.value;
        }
      }

      if (key === KEYS.up) {
        cursor = cursor > 0 ? cursor - 1 : options.length - 1;
      } else if (key === KEYS.down) {
        cursor = cursor < options.length - 1 ? cursor + 1 : 0;
      }

      // Redraw the list
      clearList(options.length);
      renderSelectList(options, cursor);
    }
  } catch {
    output.write(ANSI.showCursor);
    resetReadline();
    throw new Error('Selection cancelled');
  }
}

/**
 * Interactive multi-select with arrow keys and space to toggle
 */
async function interactiveMultiSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string; default?: boolean }[]
): Promise<T[]> {
  const output = process.stderr;
  let cursor = 0;
  const selected = new Set<number>();

  // Initialize with defaults
  options.forEach((opt, i) => {
    if (opt.default) selected.add(i);
  });

  output.write(`\n${prompt}\n`);
  output.write(dim('  (Use arrow keys, Space to toggle, Enter to confirm)\n\n'));
  output.write(ANSI.hideCursor);

  renderSelectList(options, cursor, selected);

  try {
    while (true) {
      const key = await readKey();

      if (key === KEYS.ctrlC) {
        output.write(ANSI.showCursor);
        process.exit(0);
      }

      if (key === KEYS.enter || key === KEYS.enterLF) {
        output.write(ANSI.showCursor);
        // Show what was selected
        clearList(options.length);
        const selectedOptions = options.filter((_, i) => selected.has(i));
        if (selectedOptions.length === 0) {
          output.write(`${ANSI.clearLine}  ${dim('(none selected)')}\n`);
        } else {
          for (const opt of selectedOptions) {
            output.write(`${ANSI.clearLine}  ${green('✓')} ${opt.label}\n`);
          }
        }
        // Reset readline so it's fresh for text input
        resetReadline();
        return selectedOptions.map((o) => o.value);
      }

      if (key === KEYS.space) {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else {
          selected.add(cursor);
        }
      }

      if (key === KEYS.up) {
        cursor = cursor > 0 ? cursor - 1 : options.length - 1;
      } else if (key === KEYS.down) {
        cursor = cursor < options.length - 1 ? cursor + 1 : 0;
      }

      // Redraw the list
      clearList(options.length);
      renderSelectList(options, cursor, selected);
    }
  } catch {
    output.write(ANSI.showCursor);
    resetReadline();
    throw new Error('Selection cancelled');
  }
}

function detectGitUser(): { name: string | undefined; email: string | undefined } {
  try {
    const name = execSync('git config --get user.name', { encoding: 'utf8' }).trim();
    const email = execSync('git config --get user.email', { encoding: 'utf8' }).trim();
    return { name: name || undefined, email: email || undefined };
  } catch {
    return { name: undefined, email: undefined };
  }
}

function detectGithubUsername(): string | undefined {
  try {
    const result = execSync('gh auth status 2>/dev/null && gh api user --jq .login', {
      encoding: 'utf8',
    }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateProjectName(name: string): string | null {
  if (!name) return 'Project name is required';
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return 'Project name must start with a letter and contain only lowercase letters, numbers, and hyphens';
  }
  if (name.length > 214) return 'Project name must be 214 characters or less';
  return null;
}

async function promptWithDefault(prompt: string, defaultValue: string): Promise<string> {
  const defaultHint = defaultValue ? dim(` (${defaultValue})`) : '';
  const answer = await question(`${prompt}${defaultHint}: `);
  return answer || defaultValue;
}

async function promptRequired(
  prompt: string,
  validator?: (value: string) => string | null
): Promise<string> {
  while (true) {
    const answer = await question(`${prompt}: `);
    if (!answer) {
      console.error(red('  This field is required'));
      continue;
    }
    if (validator) {
      const error = validator(answer);
      if (error) {
        console.error(red(`  ${error}`));
        continue;
      }
    }
    return answer;
  }
}

async function promptSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string }[],
  defaultIndex = 0
): Promise<T> {
  // Use interactive arrow key selection
  return interactiveSelect(prompt, options, defaultIndex);
}

async function promptConfirm(prompt: string, defaultValue = true): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = await question(`${prompt} ${dim(hint)}: `);

  if (!answer) return defaultValue;
  return answer.toLowerCase().startsWith('y');
}

async function promptMultiSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string; default?: boolean }[]
): Promise<T[]> {
  // Use interactive arrow key selection with space to toggle
  return interactiveMultiSelect(prompt, options);
}

export async function runPrompts(): Promise<ProjectConfig> {
  console.error(`\n${bold(cyan('🥐 Bakery'))}\n`);
  console.error(dim('Bake fresh projects from recipes.\n'));
  console.error(dim('Press Ctrl+C to cancel at any time.\n'));

  // Step 1: Select archetype
  const archetype = await promptSelect<Archetype>(
    bold(blue('🏗️  Project Type')),
    [
      { value: 'cli', label: 'CLI Tool - Command-line applications' },
      { value: 'api', label: 'REST API - Backend with Hono/Express/Elysia' },
      { value: 'full-stack', label: 'Full-Stack - Monorepo with API + Web' },
      { value: 'effect-cli', label: 'Effect CLI/API - Effect-ts patterns' },
      { value: 'effect-full-stack', label: 'Effect Full-Stack - Effect + Convex + TanStack' },
    ],
    0
  );

  // Step 2: Framework selection (based on archetype)
  let apiFramework: ApiFramework | undefined;
  let webFramework: WebFramework | undefined;

  if (archetype === 'api' || archetype === 'full-stack') {
    apiFramework = await promptSelect<ApiFramework>(
      bold(blue('🔧 API Framework')),
      [
        { value: 'hono', label: 'Hono - Lightweight, fast, great with Bun' },
        { value: 'express', label: 'Express - Battle-tested, huge ecosystem' },
        { value: 'elysia', label: 'Elysia - Bun-native, TypeScript-first' },
      ],
      0
    );
  }

  if (archetype === 'full-stack') {
    webFramework = await promptSelect<WebFramework>(
      bold(blue('🌐 Web Framework')),
      [
        { value: 'react-vite', label: 'React (Vite) - Fast builds, popular' },
        { value: 'nextjs', label: 'Next.js - Full-stack React with SSR' },
        { value: 'vue', label: 'Vue - Progressive framework' },
        { value: 'tanstack-start', label: 'TanStack Start - Type-safe full-stack' },
      ],
      0
    );
  }

  // Effect full-stack has fixed choices
  if (archetype === 'effect-full-stack') {
    webFramework = 'tanstack-start';
  }

  // Detect user info
  const gitUser = detectGitUser();
  const detectedGithubUsername = detectGithubUsername();

  console.error(`\n${bold(blue('📦 Project Details'))}\n`);

  const rawName = await promptRequired('Project name (e.g., my-awesome-app)', validateProjectName);
  const projectName = toKebabCase(rawName);

  if (projectName !== rawName) {
    console.error(dim(`  → Using: ${projectName}`));
  }

  const defaultDescription =
    archetype === 'cli'
      ? 'A CLI tool built with TypeScript and Bun'
      : archetype === 'api'
        ? 'A REST API built with TypeScript and Bun'
        : 'A full-stack application built with TypeScript';

  const description = await promptWithDefault('Description', defaultDescription);

  const author = await promptWithDefault('Author name', gitUser.name || '');

  const githubUsername = await promptWithDefault('GitHub username', detectedGithubUsername || '');

  const license = await promptSelect<ProjectConfig['license']>(
    bold(blue('📄 License')),
    [
      { value: 'MIT', label: 'MIT - Simple and permissive' },
      { value: 'Apache-2.0', label: 'Apache 2.0 - Permissive with patent grant' },
      { value: 'ISC', label: 'ISC - Simplified MIT' },
      { value: 'GPL-3.0', label: 'GPL 3.0 - Copyleft' },
      { value: 'BSD-3-Clause', label: 'BSD 3-Clause - Permissive' },
    ],
    0
  );

  // Step 3: Addon selection
  const addonOptions: { value: Addon; label: string; default?: boolean }[] = [
    { value: 'docker', label: 'Docker - Containerized development', default: true },
    { value: 'ci', label: 'GitHub Actions CI - Automated testing', default: true },
    { value: 'docs', label: 'TypeDoc - API documentation', default: true },
    { value: 'security', label: 'Trivy - Security scanning', default: true },
  ];

  // Add archetype-specific addons
  if (archetype === 'cli') {
    addonOptions.push({
      value: 'release',
      label: 'Release workflow - Auto-build binaries',
      default: true,
    });
  }

  if (archetype !== 'effect-cli' && archetype !== 'effect-full-stack') {
    addonOptions.push(
      { value: 'zod', label: 'Zod - Runtime type validation', default: true },
      { value: 'neverthrow', label: 'neverthrow - Type-safe error handling', default: false }
    );
  }

  // TanStack addons for web projects
  if (archetype === 'full-stack' && webFramework !== 'nextjs') {
    addonOptions.push(
      { value: 'tanstack-query', label: 'TanStack Query - Data fetching', default: true },
      { value: 'tanstack-router', label: 'TanStack Router - Type-safe routing', default: false },
      { value: 'tanstack-form', label: 'TanStack Form - Form management', default: false }
    );
  }

  // Convex for API/full-stack
  if (archetype === 'api' || archetype === 'full-stack') {
    addonOptions.push({ value: 'convex', label: 'Convex - Real-time database', default: false });
  }

  // Effect full-stack always includes convex
  if (archetype === 'effect-full-stack') {
    addonOptions.push(
      { value: 'convex', label: 'Convex - Real-time database', default: true },
      { value: 'tanstack-query', label: 'TanStack Query - Data fetching', default: true }
    );
  }

  const addons = await promptMultiSelect<Addon>(bold(blue('🛠️  Addons')), addonOptions);

  // Add dependabot if CI is selected
  if (addons.includes('ci')) {
    const includeDependabot = await promptConfirm(
      'Include Dependabot (automated dependency updates)?',
      true
    );
    if (includeDependabot) {
      addons.push('dependabot');
    }
  }

  console.error(`\n${bold(green('✓ Configuration complete!'))}\n`);

  return {
    projectName,
    description,
    author,
    license,
    githubUsername,
    archetype,
    apiFramework,
    webFramework,
    addons,
  };
}

export function closePrompts(): void {
  resetReadline();
}

const archetypeLabels: Record<Archetype, string> = {
  cli: 'CLI Tool',
  api: 'REST API',
  'full-stack': 'Full-Stack',
  'effect-cli': 'Effect CLI/API',
  'effect-full-stack': 'Effect Full-Stack',
};

const frameworkLabels: Record<string, string> = {
  hono: 'Hono',
  express: 'Express',
  elysia: 'Elysia',
  'react-vite': 'React (Vite)',
  nextjs: 'Next.js',
  vue: 'Vue',
  'tanstack-start': 'TanStack Start',
};

export function printSummary(config: ProjectConfig, outputDir: string): void {
  console.error(bold(cyan('\n📋 Summary\n')));
  console.error(`  ${dim('Project:')}     ${config.projectName}`);
  console.error(`  ${dim('Type:')}        ${archetypeLabels[config.archetype]}`);
  if (config.apiFramework) {
    console.error(`  ${dim('API:')}         ${frameworkLabels[config.apiFramework]}`);
  }
  if (config.webFramework) {
    console.error(`  ${dim('Web:')}         ${frameworkLabels[config.webFramework]}`);
  }
  console.error(`  ${dim('Description:')} ${config.description}`);
  if (config.author) console.error(`  ${dim('Author:')}      ${config.author}`);
  if (config.githubUsername) console.error(`  ${dim('GitHub:')}      ${config.githubUsername}`);
  console.error(`  ${dim('License:')}     ${config.license}`);

  console.error(bold(cyan('\n🛠️  Addons\n')));
  const hasAddon = (addon: Addon) => config.addons.includes(addon);
  console.error(`  ${dim('Docker:')}      ${hasAddon('docker') ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('CI:')}          ${hasAddon('ci') ? green('Yes') : yellow('No')}`);
  if (hasAddon('ci')) {
    console.error(`  ${dim('Release:')}     ${hasAddon('release') ? green('Yes') : yellow('No')}`);
    console.error(
      `  ${dim('Dependabot:')}  ${hasAddon('dependabot') ? green('Yes') : yellow('No')}`
    );
  }
  console.error(`  ${dim('Docs:')}        ${hasAddon('docs') ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('Security:')}    ${hasAddon('security') ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('Zod:')}         ${hasAddon('zod') ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('neverthrow:')}  ${hasAddon('neverthrow') ? green('Yes') : yellow('No')}`);
  if (hasAddon('convex')) {
    console.error(`  ${dim('Convex:')}      ${green('Yes')}`);
  }
  if (hasAddon('tanstack-query')) {
    console.error(`  ${dim('TanStack Q:')}  ${green('Yes')}`);
  }
  console.error(`\n  ${dim('Output:')}      ${outputDir}`);
}
