#!/usr/bin/env bun

import { bold, cyan, dim, error, green } from './utils/colors.js';
import { ArgumentError } from './utils/errors.js';
import { runWizard } from './wizard/index.js';

const VERSION = '0.1.0';

interface CliOptions {
  output?: string;
  version?: boolean;
  help?: boolean;
}

function printHelp(): void {
  console.log(`
${bold(cyan('cli-template'))} v${VERSION}
${dim('Create new CLI projects with modern TypeScript tooling')}

${bold('USAGE:')}
  cli-template [options] [output-directory]

${bold('OPTIONS:')}
  -o, --output <dir>   Output directory (default: ./<project-name>)
  -v, --version        Show version number
  -h, --help           Show this help message

${bold('EXAMPLES:')}
  ${dim('# Run interactive wizard')}
  cli-template

  ${dim('# Create project in specific directory')}
  cli-template -o ./my-project

  ${dim('# Quick install via curl')}
  curl -fsSL https://raw.githubusercontent.com/username/cli-template/main/install.sh | bash

${bold('WHAT YOU GET:')}
  ${green('✓')} TypeScript + Bun runtime
  ${green('✓')} Biome (linting + formatting)
  ${green('✓')} Oxlint (supplementary linting)
  ${green('✓')} Lefthook (git hooks)
  ${green('✓')} GitHub Actions CI/CD
  ${green('✓')} Docker support
  ${green('✓')} Cross-platform binary builds
  ${green('✓')} Makefile for common tasks
`);
}

function parseArgs(args: string[]): { options: CliOptions; positional: string[] } {
  const options: CliOptions = {};
  const positional: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-o':
      case '--output':
        options.output = args[++i];
        if (!options.output) {
          throw new ArgumentError('--output requires a directory path');
        }
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new ArgumentError(`Unknown option: ${arg}`);
        }
        positional.push(arg);
    }
    i++;
  }

  return { options, positional };
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const { options, positional } = parseArgs(args);

    if (options.version) {
      console.log(VERSION);
      process.exit(0);
    }

    if (options.help) {
      printHelp();
      process.exit(0);
    }

    const outputPath = options.output || positional[0];

    await runWizard(outputPath);
  } catch (err) {
    if (err instanceof ArgumentError) {
      console.error(error(err.message));
      console.error('Run "cli-template --help" for usage information');
      process.exit(1);
    }

    console.error(error(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

main();
