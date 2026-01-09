import { execSync } from 'node:child_process';
import * as readline from 'node:readline';
import { blue, bold, cyan, dim, green, red, yellow } from '../utils/colors.js';

export interface ProjectConfig {
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
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stderr,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function detectGitUser(): { name?: string; email?: string } {
  try {
    const name = execSync('git config --get user.name', { encoding: 'utf8' }).trim();
    const email = execSync('git config --get user.email', { encoding: 'utf8' }).trim();
    return { name: name || undefined, email: email || undefined };
  } catch {
    return {};
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
  console.error(`\n${prompt}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? green('→') : ' ';
    const label = i === defaultIndex ? bold(opt.label) : opt.label;
    console.error(`  ${marker} ${i + 1}. ${label}`);
  });

  while (true) {
    const answer = await question(`${dim('Enter number')} [${defaultIndex + 1}]: `);
    if (!answer) return options[defaultIndex].value;

    const num = parseInt(answer, 10);
    if (num >= 1 && num <= options.length) {
      return options[num - 1].value;
    }
    console.error(red(`  Please enter a number between 1 and ${options.length}`));
  }
}

async function promptConfirm(prompt: string, defaultValue = true): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = await question(`${prompt} ${dim(hint)}: `);

  if (!answer) return defaultValue;
  return answer.toLowerCase().startsWith('y');
}

export async function runPrompts(): Promise<ProjectConfig> {
  console.error(`\n${bold(cyan('🚀 CLI Template Wizard'))}\n`);
  console.error(dim('Create a new CLI project with modern TypeScript tooling.\n'));
  console.error(dim('Press Ctrl+C to cancel at any time.\n'));

  // Detect user info
  const gitUser = detectGitUser();
  const detectedGithubUsername = detectGithubUsername();

  console.error(`${bold(blue('📦 Project Details'))}\n`);

  const rawName = await promptRequired('Project name (e.g., my-awesome-cli)', validateProjectName);
  const projectName = toKebabCase(rawName);

  if (projectName !== rawName) {
    console.error(dim(`  → Using: ${projectName}`));
  }

  const description = await promptWithDefault(
    'Description',
    `A CLI tool built with TypeScript and Bun`
  );

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

  console.error(`\n${bold(blue('🛠️  Features'))}\n`);

  const includeDocker = await promptConfirm('Include Docker support?', true);
  const includeCi = await promptConfirm('Include GitHub Actions CI?', true);
  const includeReleaseWorkflow = includeCi
    ? await promptConfirm('Include release workflow (auto-build binaries)?', true)
    : false;
  const includeDocs = await promptConfirm('Include TypeDoc (API documentation)?', true);
  const includeSecurity = await promptConfirm('Include Trivy (security scanning)?', true);

  console.error(`\n${bold(green('✓ Configuration complete!'))}\n`);

  return {
    projectName,
    description,
    author,
    license,
    githubUsername,
    includeDocker,
    includeCi,
    includeReleaseWorkflow,
    includeDocs,
    includeSecurity,
  };
}

export function closePrompts(): void {
  rl.close();
}

export function printSummary(config: ProjectConfig, outputDir: string): void {
  console.error(bold(cyan('\n📋 Summary\n')));
  console.error(`  ${dim('Project:')}     ${config.projectName}`);
  console.error(`  ${dim('Description:')} ${config.description}`);
  if (config.author) console.error(`  ${dim('Author:')}      ${config.author}`);
  if (config.githubUsername) console.error(`  ${dim('GitHub:')}      ${config.githubUsername}`);
  console.error(`  ${dim('License:')}     ${config.license}`);
  console.error(`  ${dim('Docker:')}      ${config.includeDocker ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('CI:')}          ${config.includeCi ? green('Yes') : yellow('No')}`);
  if (config.includeCi) {
    console.error(
      `  ${dim('Release:')}     ${config.includeReleaseWorkflow ? green('Yes') : yellow('No')}`
    );
  }
  console.error(`  ${dim('Docs:')}        ${config.includeDocs ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('Security:')}    ${config.includeSecurity ? green('Yes') : yellow('No')}`);
  console.error(`  ${dim('Output:')}      ${outputDir}`);
}
