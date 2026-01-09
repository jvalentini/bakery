#!/usr/bin/env bun

import { z } from 'zod';
import { handlePluginsCommand } from './commands/plugins.js';
import { bold, cyan, dim, error, green } from './utils/colors.js';
import { runWizard } from './wizard/index.js';

const VERSION = '0.1.0';

/**
 * CLI options schema with runtime validation
 */
const CliOptionsSchema = z.object({
  output: z
    .string()
    .min(1, 'Output directory cannot be empty')
    .optional()
    .describe('Output directory for the generated project'),
  version: z.boolean().default(false).describe('Show version number'),
  help: z.boolean().default(false).describe('Show help message'),
});

type CliOptions = z.infer<typeof CliOptionsSchema>;

/**
 * Parsed CLI result containing options and positional arguments
 */
interface ParsedCli {
  options: CliOptions;
  positional: string[];
}

function printHelp(): void {
  console.log(`
${bold(cyan('bakery'))} v${VERSION}
${dim('Bake fresh projects from recipes - a modular project scaffolder')}

${bold('USAGE:')}
  bakery [options] [output-directory]
  bakery <command> [args]

${bold('COMMANDS:')}
  plugins              Manage Bakery plugins (list, add, remove, create)

${bold('OPTIONS:')}
  -o, --output <dir>   Output directory (default: ./<project-name>)
  -v, --version        Show version number
  -h, --help           Show this help message

${bold('EXAMPLES:')}
  ${dim('# Run interactive wizard')}
  bakery

  ${dim('# Create project in specific directory')}
  bakery -o ./my-project

  ${dim('# List installed plugins')}
  bakery plugins list

  ${dim('# Install a plugin')}
  bakery plugins add tailwind

${bold('ARCHETYPES:')}
  ${green('•')} CLI Tool - Command-line applications
  ${green('•')} REST API - Backend with Hono/Express/Elysia
  ${green('•')} Full-Stack - Monorepo with API + Web
  ${green('•')} Effect CLI/API - Effect-ts patterns
  ${green('•')} Effect Full-Stack - Effect + Convex + TanStack

${bold('INCLUDED IN ALL PROJECTS:')}
  ${green('✓')} TypeScript + Bun runtime
  ${green('✓')} Biome (linting + formatting)
  ${green('✓')} Oxlint (supplementary linting)
  ${green('✓')} Lefthook (git hooks)
  ${green('✓')} Makefile for common tasks
`);
}

/**
 * Parse raw CLI arguments into validated options and positional args
 */
function parseArgs(args: readonly string[]): ParsedCli {
  const rawOptions: Record<string, unknown> = {};
  const positional: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === undefined) {
      i++;
      continue;
    }

    switch (arg) {
      case '-o':
      case '--output': {
        const nextArg = args[i + 1];
        if (nextArg === undefined || nextArg.startsWith('-')) {
          throw new CliParseError('--output requires a directory path');
        }
        rawOptions['output'] = nextArg;
        i += 2;
        break;
      }
      case '-v':
      case '--version':
        rawOptions['version'] = true;
        i++;
        break;
      case '-h':
      case '--help':
        rawOptions['help'] = true;
        i++;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new CliParseError(`Unknown option: ${arg}`);
        }
        positional.push(arg);
        i++;
    }
  }

  // Validate options against schema
  const parseResult = CliOptionsSchema.safeParse(rawOptions);

  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    const firstIssue = issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
      : 'Invalid CLI options';
    throw new CliParseError(message);
  }

  return { options: parseResult.data, positional };
}

/**
 * Custom error class for CLI parsing failures
 */
class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliParseError';
  }
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    // Handle subcommands first
    const firstArg = args[0];
    if (firstArg === 'plugins') {
      await handlePluginsCommand(args.slice(1));
      process.exit(0);
    }

    const { options, positional } = parseArgs(args);

    if (options.version) {
      console.log(VERSION);
      process.exit(0);
    }

    if (options.help) {
      printHelp();
      process.exit(0);
    }

    const outputPath = options.output ?? positional[0];

    await runWizard(outputPath);
  } catch (err) {
    if (err instanceof CliParseError) {
      console.error(error(err.message));
      console.error('Run "bakery --help" for usage information');
      process.exit(1);
    }

    console.error(error(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(error(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
