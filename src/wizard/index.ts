import * as fs from 'node:fs';
import * as path from 'node:path';
import { bold, cyan, dim, green, red, yellow } from '../utils/colors.js';
import { generateProject } from './generator.js';
import { closePrompts, type ProjectConfig, printSummary, runPrompts } from './prompts.js';

function validateOutputDir(outputDir: string): void {
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    if (files.length > 0) {
      console.error(red(`\nError: Directory '${outputDir}' already exists and is not empty.`));
      console.error(yellow('Please choose a different name or remove the existing directory.\n'));
      process.exit(1);
    }
  }
}

function printNextSteps(projectName: string): void {
  console.error(bold(green('\n✓ Project created successfully!\n')));
  console.error(bold(cyan('Next steps:\n')));
  console.error(`  ${dim('1.')} cd ${projectName}`);
  console.error(`  ${dim('2.')} make install`);
  console.error(`  ${dim('3.')} make dev`);
  console.error('');
  console.error(dim('Run `make help` to see all available commands.\n'));
}

export async function runWizard(outputPath?: string): Promise<void> {
  try {
    const config = await runPrompts();

    const outputDir = outputPath
      ? path.resolve(outputPath)
      : path.resolve(process.cwd(), config.projectName);

    validateOutputDir(outputDir);
    printSummary(config, outputDir);

    console.error(`\n${dim('Generating project...')}`);
    generateProject(config, outputDir);

    printNextSteps(config.projectName);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') {
      console.error(`\n${dim('Cancelled.\n')}`);
      process.exit(0);
    }
    throw err;
  } finally {
    closePrompts();
  }
}

export async function runFromConfig(config: ProjectConfig, outputPath?: string): Promise<void> {
  const outputDir = outputPath
    ? path.resolve(outputPath)
    : path.resolve(process.cwd(), config.projectName);

  validateOutputDir(outputDir);
  printSummary(config, outputDir);

  console.error(`\n${dim('Generating project...')}`);
  generateProject(config, outputDir);

  printNextSteps(config.projectName);
}
