import { execSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import { createManifest, saveManifest } from '../sync/manifest.js'
import {
  createTemplateContext,
  processTemplateDirectory,
  type TemplateContext,
  writeTemplates,
} from '../templates/engine.js'
import {
  type ArchetypeManifest,
  getTemplatesDir,
  loadTemplateManifest,
  resolveTemplates,
  type SetupTask,
} from '../templates/loader.js'
import type { ProjectConfig } from './prompts.js'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json') as { version: string }

export interface DryRunFile {
  path: string
  size: number
}

export interface DryRunResult {
  files: DryRunFile[]
  totalSize: number
  commands: string[]
  dependencies: string[]
  devDependencies: string[]
}

export function generateProjectDryRun(config: ProjectConfig, outputDir: string): DryRunResult {
  const context = createTemplateContext({
    projectName: config.projectName,
    description: config.description,
    author: config.author,
    license: config.license,
    githubUsername: config.githubUsername,
    archetype: config.archetype,
    apiFramework: config.apiFramework,
    webFramework: config.webFramework,
    addons: config.addons,
  })

  const templatesDir = getTemplatesDir()
  const archetypePath = path.join(templatesDir, config.archetype)
  const manifest = loadTemplateManifest(archetypePath)

  const result: DryRunResult = {
    files: [],
    totalSize: 0,
    commands: [],
    dependencies: [],
    devDependencies: [],
  }

  if (manifest?.baseCommand) {
    const projectName = path.basename(outputDir)
    const command = manifest.baseCommand.command
      .replace(/\{\{projectName\}\}/g, projectName)
      .replace(/\{\{parentDir\}\}/g, path.dirname(outputDir))
    result.commands.push(command)

    if (manifest.postProcess) {
      for (const [name, version] of Object.entries(manifest.postProcess.addDeps)) {
        result.dependencies.push(`${name}@${version}`)
      }
      for (const [name, version] of Object.entries(manifest.postProcess.addDevDeps)) {
        result.devDependencies.push(`${name}@${version}`)
      }
    }
  }

  const templates = resolveTemplates(config.archetype, config.addons)
  for (const template of templates) {
    const files = processTemplateDirectory(template.path, context)
    for (const [filePath, content] of files) {
      if (filePath !== 'template.json') {
        result.files.push({ path: filePath, size: Buffer.byteLength(content, 'utf-8') })
        result.totalSize += Buffer.byteLength(content, 'utf-8')
      }
    }
  }

  const overlaysPath = path.join(archetypePath, 'overlays')
  if (fs.existsSync(overlaysPath)) {
    const files = processTemplateDirectory(overlaysPath, context)
    for (const [filePath, content] of files) {
      if (filePath !== 'template.json') {
        const existingIndex = result.files.findIndex((f) => f.path === filePath)
        const size = Buffer.byteLength(content, 'utf-8')
        if (existingIndex >= 0) {
          const existing = result.files[existingIndex]
          if (existing) {
            result.totalSize -= existing.size
            result.files[existingIndex] = { path: filePath, size }
          }
        } else {
          result.files.push({ path: filePath, size })
        }
        result.totalSize += size
      }
    }
  }

  return result
}

export function generateProject(config: ProjectConfig, outputDir: string): void {
  const context = createTemplateContext({
    projectName: config.projectName,
    description: config.description,
    author: config.author,
    license: config.license,
    githubUsername: config.githubUsername,
    archetype: config.archetype,
    apiFramework: config.apiFramework,
    webFramework: config.webFramework,
    addons: config.addons,
  })

  const templatesDir = getTemplatesDir()
  const archetypePath = path.join(templatesDir, config.archetype)
  const manifest = loadTemplateManifest(archetypePath)

  if (manifest?.baseCommand) {
    generateFromBaseCommand(config, outputDir, manifest, context)
  } else {
    generateFromTemplates(config, outputDir, context)
  }
}

function generateFromBaseCommand(
  config: ProjectConfig,
  outputDir: string,
  manifest: ArchetypeManifest,
  context: TemplateContext,
): void {
  const baseCommand = manifest.baseCommand
  if (!baseCommand) return

  const parentDir = path.dirname(outputDir)
  const projectName = path.basename(outputDir)

  const command = baseCommand.command
    .replace(/\{\{projectName\}\}/g, projectName)
    .replace(/\{\{parentDir\}\}/g, parentDir)

  const workdir = baseCommand.workdir
    .replace(/\{\{projectName\}\}/g, projectName)
    .replace(/\{\{parentDir\}\}/g, parentDir)

  if (!fs.existsSync(workdir)) {
    fs.mkdirSync(workdir, { recursive: true })
  }

  console.log(`Running: ${command}`)
  const result = spawnSync(command, {
    cwd: workdir,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  })

  if (result.status !== 0) {
    throw new Error(`Base command failed with exit code ${result.status}`)
  }

  if (manifest.postProcess) {
    runPostProcess(outputDir, manifest.postProcess)
  }

  applyTemplateFiles(config, outputDir, context)
  applyOverlays(config, outputDir, context)
  writeSetupConfig(config, outputDir)
  initGitRepo(outputDir)
}

function runPostProcess(
  outputDir: string,
  postProcess: NonNullable<ArchetypeManifest['postProcess']>,
): void {
  for (const file of postProcess.remove) {
    const filePath = path.join(outputDir, file)
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { recursive: true })
      console.log(`Removed: ${file}`)
    }
  }

  const pkgPath = path.join(outputDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

  for (const dep of postProcess.removeDeps) {
    if (pkg.dependencies?.[dep]) {
      delete pkg.dependencies[dep]
      console.log(`Removed dependency: ${dep}`)
    }
    if (pkg.devDependencies?.[dep]) {
      delete pkg.devDependencies[dep]
      console.log(`Removed devDependency: ${dep}`)
    }
  }

  for (const [name, version] of Object.entries(postProcess.addDeps)) {
    pkg.dependencies = pkg.dependencies || {}
    pkg.dependencies[name] = version
    console.log(`Added dependency: ${name}@${version}`)
  }

  for (const [name, version] of Object.entries(postProcess.addDevDeps)) {
    pkg.devDependencies = pkg.devDependencies || {}
    pkg.devDependencies[name] = version
    console.log(`Added devDependency: ${name}@${version}`)
  }

  for (const [name, script] of Object.entries(postProcess.updateScripts)) {
    pkg.scripts = pkg.scripts || {}
    pkg.scripts[name] = script
    console.log(`Updated script: ${name}`)
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

function applyOverlays(config: ProjectConfig, outputDir: string, context: TemplateContext): void {
  const templatesDir = getTemplatesDir()
  const archetypePath = path.join(templatesDir, config.archetype)
  const overlaysPath = path.join(archetypePath, 'overlays')

  if (!fs.existsSync(overlaysPath)) return

  const files = processTemplateDirectory(overlaysPath, context)
  for (const [filePath, content] of files) {
    if (filePath === 'template.json') continue
    const fullPath = path.join(outputDir, filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(fullPath, content)
    console.log(`Applied overlay: ${filePath}`)
  }
}

function applyTemplateFiles(
  config: ProjectConfig,
  outputDir: string,
  context: TemplateContext,
): void {
  const templates = resolveTemplates(config.archetype, config.addons)

  for (const template of templates) {
    if (template.manifest.name === config.archetype) continue

    const files = processTemplateDirectory(template.path, context)
    for (const [filePath, content] of files) {
      if (filePath === 'template.json') continue
      const fullPath = path.join(outputDir, filePath)
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(fullPath, content)
      console.log(`Applied template: ${filePath} (from ${template.manifest.name})`)
    }
  }
}

function generateFromTemplates(
  config: ProjectConfig,
  outputDir: string,
  context: TemplateContext,
): void {
  const templates = resolveTemplates(config.archetype, config.addons)
  const allFiles = new Map<string, string>()

  for (const template of templates) {
    const files = processTemplateDirectory(template.path, context)
    for (const [filePath, content] of files) {
      if (filePath !== 'template.json') {
        allFiles.set(filePath, content)
      }
    }
  }

  writeTemplates(allFiles, outputDir)
  writeSetupConfig(config, outputDir)
  initGitRepo(outputDir)
}

function initGitRepo(outputDir: string): void {
  const gitDir = path.join(outputDir, '.git')
  if (!fs.existsSync(gitDir)) {
    try {
      execSync('git init', { cwd: outputDir, stdio: 'ignore' })
    } catch {
      // Git not available or failed - that's OK
    }
  }
}

function collectSetupTasks(config: ProjectConfig): SetupTask[] {
  const templates = resolveTemplates(config.archetype, config.addons)
  const tasks: SetupTask[] = []
  const seenNames = new Set<string>()

  for (const template of templates) {
    for (const task of template.manifest.tasks) {
      if (!seenNames.has(task.name)) {
        tasks.push(task)
        seenNames.add(task.name)
      }
    }
  }

  return tasks
}

function writeSetupConfig(config: ProjectConfig, outputDir: string): void {
  const tasks = collectSetupTasks(config)

  const setupConfig = {
    archetype: config.archetype,
    generatedAt: new Date().toISOString(),
    tasks,
  }

  const bakeryDir = path.join(outputDir, '.bakery')
  if (!fs.existsSync(bakeryDir)) {
    fs.mkdirSync(bakeryDir, { recursive: true })
  }

  fs.writeFileSync(path.join(bakeryDir, 'setup.json'), `${JSON.stringify(setupConfig, null, 2)}\n`)

  const manifestResult = createManifest(outputDir, {
    bakeryVersion: pkg.version,
    archetype: config.archetype,
    addons: config.addons,
  })

  if (manifestResult.isOk()) {
    const saveResult = saveManifest(outputDir, manifestResult.value)
    if (saveResult.isErr()) {
      console.error(`Warning: Failed to write manifest: ${saveResult.error.message}`)
    }
  } else {
    console.error(`Warning: Failed to create manifest: ${manifestResult.error.message}`)
  }
}

/**
 * Legacy function for backward compatibility
 * Creates a CLI project with inline templates (deprecated)
 */
export function generateProjectLegacy(config: ProjectConfig, outputDir: string): void {
  const context = createTemplateContext({
    projectName: config.projectName,
    description: config.description,
    author: config.author,
    license: config.license,
    githubUsername: config.githubUsername,
    archetype: config.archetype,
    apiFramework: config.apiFramework,
    webFramework: config.webFramework,
    addons: config.addons,
  })

  // Check if template directory exists for the archetype
  const templatesDir = getTemplatesDir()
  const archetypePath = path.join(templatesDir, config.archetype)

  if (fs.existsSync(archetypePath)) {
    // Use the new template system
    generateProject(config, outputDir)
  } else {
    // Fall back to inline generation for archetypes without templates yet
    generateInlineProject(context, config, outputDir)
  }
}

/**
 * Helper to write a file, creating directories as needed
 */
function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, content, 'utf-8')
}

/**
 * Helper to check if an addon is enabled
 */
function hasAddon(config: ProjectConfig, addon: string): boolean {
  return config.addons.includes(addon as ProjectConfig['addons'][number])
}

/**
 * Generate project using inline templates (legacy fallback)
 */
function generateInlineProject(
  context: TemplateContext,
  config: ProjectConfig,
  outputDir: string,
): void {
  // Generate package.json
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
      test: 'bun test',
      lint: 'biome check .',
      'lint:fix': 'biome check --write .',
      typecheck: 'tsc --noEmit',
      check: 'bun run typecheck && bun run lint',
    },
    keywords: ['cli', 'typescript', 'bun'],
    author: context.author,
    license: context.license,
    dependencies: {
      ...(hasAddon(config, 'zod') && { zod: '^3.24.0' }),
      ...(hasAddon(config, 'neverthrow') && { neverthrow: '^8.2.0' }),
    },
    devDependencies: {
      '@biomejs/biome': '^2.3.11',
      '@types/node': '^20.0.0',
      'bun-types': 'latest',
      lefthook: '^2.0.13',
      typescript: '^5.0.0',
      '@tsconfig/strictest': '^2.0.0',
    },
  }

  writeFile(path.join(outputDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)

  // Generate basic CLI
  const cliTs = `#!/usr/bin/env bun

const VERSION = '0.1.0';

function printHelp(): void {
  console.log(\`
${context.projectName} v\${VERSION}
${context.description}

USAGE:
  ${context.projectName} [options] <command>

COMMANDS:
  hello              Print a greeting message

OPTIONS:
  -h, --help         Show this help message
  --version          Show version number
\`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version')) {
    console.log(VERSION);
    return;
  }

  const command = args[0];
  if (command === 'hello') {
    console.log('Hello from ${context.projectName}!');
  } else {
    console.error(\`Unknown command: \${command}\`);
    process.exit(1);
  }
}

main();
`

  writeFile(path.join(outputDir, 'src', 'cli.ts'), cliTs)

  // Generate tsconfig.json
  const tsconfig = {
    extends: '@tsconfig/strictest/tsconfig.json',
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      lib: ['ES2022'],
      moduleResolution: 'bundler',
      outDir: './dist',
      rootDir: './src',
      types: ['bun-types'],
    },
    include: ['src/**/*.ts'],
    exclude: ['node_modules', 'dist'],
  }

  writeFile(path.join(outputDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`)

  // Generate README
  const readme = `# ${context.projectName}

${context.description}

## Installation

\`\`\`bash
bun install
\`\`\`

## Usage

\`\`\`bash
bun run src/cli.ts --help
\`\`\`

## License

${context.license}${context.author ? ` - ${context.author}` : ''}
`

  writeFile(path.join(outputDir, 'README.md'), readme)

  // Generate .gitignore
  const gitignore = `node_modules/
dist/
*.log
.DS_Store
`

  writeFile(path.join(outputDir, '.gitignore'), gitignore)

  initGitRepo(outputDir)
}
