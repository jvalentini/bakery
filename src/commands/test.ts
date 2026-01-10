import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadConfigFile } from '../config/index.js'
import { bold, dim, green, red, yellow } from '../utils/colors.js'
import { generateProject } from '../wizard/generator.js'

type Tier = 'smoke' | 'quick' | 'full'

interface ValidationResult {
  config: string
  tier: Tier
  success: boolean
  duration: number
  errors: string[]
}

const SKIP_QUICK_FULL = new Set(['full-stack-tanstack'])

function runCommand(cwd: string, command: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300000,
    })
    return { success: true, output }
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string }
    return {
      success: false,
      output: execError.stderr || execError.stdout || execError.message || 'Unknown error',
    }
  }
}

function fileExists(dir: string, ...parts: string[]): boolean {
  return fs.existsSync(path.join(dir, ...parts))
}

function isValidJson(dir: string, ...parts: string[]): boolean {
  try {
    const content = fs.readFileSync(path.join(dir, ...parts), 'utf-8')
    JSON.parse(content)
    return true
  } catch {
    return false
  }
}

function validateSmoke(projectDir: string): string[] {
  const errors: string[] = []

  const requiredFiles = ['package.json', 'tsconfig.json', 'biome.json', 'Makefile', 'README.md']

  for (const file of requiredFiles) {
    if (!fileExists(projectDir, file)) {
      errors.push(`Missing required file: ${file}`)
    }
  }

  const jsonFiles = ['package.json', 'tsconfig.json', 'biome.json']
  for (const file of jsonFiles) {
    if (fileExists(projectDir, file) && !isValidJson(projectDir, file)) {
      errors.push(`Invalid JSON in: ${file}`)
    }
  }

  if (fileExists(projectDir, 'package.json')) {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'))
    if (!pkg.name) {
      errors.push('package.json missing name field')
    }
    if (!pkg.scripts) {
      errors.push('package.json missing scripts field')
    }
  }

  return errors
}

function validateQuick(projectDir: string): string[] {
  const errors: string[] = []

  console.log(dim('    Running bun install...'))
  const installResult = runCommand(projectDir, 'bun install')
  if (!installResult.success) {
    errors.push(`bun install failed: ${installResult.output.slice(0, 500)}`)
    return errors
  }

  console.log(dim('    Running typecheck...'))
  const typecheckResult = runCommand(projectDir, 'bun run typecheck')
  if (!typecheckResult.success) {
    errors.push(`typecheck failed: ${typecheckResult.output.slice(0, 500)}`)
  }

  return errors
}

function validateFull(projectDir: string): string[] {
  const errors: string[] = []

  console.log(dim('    Running make check...'))
  const checkResult = runCommand(projectDir, 'make check')
  if (!checkResult.success) {
    errors.push(`make check failed: ${checkResult.output.slice(0, 500)}`)
  }

  console.log(dim('    Running tests...'))
  const testResult = runCommand(projectDir, 'bun run test')
  if (!testResult.success) {
    errors.push(`tests failed: ${testResult.output.slice(0, 500)}`)
  }

  console.log(dim('    Running build...'))
  const buildResult = runCommand(projectDir, 'bun run build')
  if (!buildResult.success) {
    errors.push(`build failed: ${buildResult.output.slice(0, 500)}`)
  }

  return errors
}

function validateConfig(configPath: string, tier: Tier, baseDir: string): ValidationResult {
  const configName = path.basename(configPath, '.json')
  const startTime = Date.now()
  const errors: string[] = []

  console.log(`\n${bold(configName)} ${dim(`(tier: ${tier})`)}`)

  const configResult = loadConfigFile(configPath)
  if (configResult.isErr()) {
    errors.push(`Failed to load config: ${JSON.stringify(configResult.error)}`)
    return {
      config: configName,
      tier,
      success: false,
      duration: Date.now() - startTime,
      errors,
    }
  }

  const projectDir = path.join(baseDir, configName)

  try {
    console.log(dim('  Generating project...'))
    generateProject(configResult.value, projectDir)
  } catch (err) {
    errors.push(`Generation failed: ${err instanceof Error ? err.message : String(err)}`)
    return {
      config: configName,
      tier,
      success: false,
      duration: Date.now() - startTime,
      errors,
    }
  }

  console.log(dim('  Running smoke checks...'))
  errors.push(...validateSmoke(projectDir))

  if ((tier === 'quick' || tier === 'full') && errors.length === 0) {
    if (SKIP_QUICK_FULL.has(configName)) {
      console.log(dim('  Skipping quick/full (requires codegen)'))
    } else {
      errors.push(...validateQuick(projectDir))
    }
  }

  if (tier === 'full' && errors.length === 0 && !SKIP_QUICK_FULL.has(configName)) {
    errors.push(...validateFull(projectDir))
  }

  const duration = Date.now() - startTime
  const isSuccess = errors.length === 0

  if (isSuccess) {
    console.log(`  ${green(bold('PASS'))} ${dim(`(${duration}ms)`)}`)
  } else {
    console.log(`  ${red(bold('FAIL'))} ${dim(`(${duration}ms)`)}`)
    for (const error of errors) {
      console.log(`    ${red('-')} ${error.slice(0, 200)}`)
    }
  }

  return {
    config: configName,
    tier,
    success: isSuccess,
    duration,
    errors,
  }
}

function printTestSummary(results: ValidationResult[]): void {
  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log('')
  console.log(dim('─'.repeat(40)))
  console.log(bold('Summary'))
  console.log(`  Total: ${results.length} configs`)
  console.log(`  ${green(`Passed: ${passed}`)}`)
  if (failed > 0) {
    console.log(`  ${red(`Failed: ${failed}`)}`)
  }
  console.log(`  Duration: ${(totalDuration / 1000).toFixed(1)}s`)

  if (failed > 0) {
    console.log('')
    console.log(red(bold('Failed configs:')))
    for (const result of results.filter((r) => !r.success)) {
      console.log(`  - ${result.config}`)
    }
  }
}

export function printTestHelp(): void {
  console.log(`
${bold('bakery test')} - Run template validation tests

${bold('USAGE:')}
  bakery test [options]

${bold('OPTIONS:')}
  --tier <tier>         Validation tier: smoke, quick, or full (default: smoke)
  --config <name>       Test specific config only (e.g., cli, api-hono)
  --keep                Keep generated projects (don't cleanup)
  -h, --help            Show this help message

${bold('TIERS:')}
  ${green('smoke')}   Generate + file existence + valid JSON ${dim('(~5s per config)')}
  ${yellow('quick')}   Above + bun install + typecheck ${dim('(~60s per config)')}
  ${red('full')}    Above + make check + test + build ${dim('(~5-10min per config)')}

${bold('EXAMPLES:')}
  ${dim('# Run smoke tests on all configs')}
  bakery test

  ${dim('# Run quick tests')}
  bakery test --tier=quick

  ${dim('# Test a specific config with full validation')}
  bakery test --tier=full --config=cli

  ${dim('# Keep generated projects for inspection')}
  bakery test --tier=quick --keep
`)
}

export async function handleTestCommand(args: string[]): Promise<void> {
  let tier: Tier = 'smoke'
  let configFilter: string | undefined
  let keep = false
  let showHelp = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue

    if (arg === '--keep') {
      keep = true
    } else if (arg === '-h' || arg === '--help') {
      showHelp = true
    } else if (arg.startsWith('--tier=')) {
      const value = arg.slice(7)
      if (value === 'smoke' || value === 'quick' || value === 'full') {
        tier = value
      } else {
        console.error(red(`Invalid tier: ${value}. Must be smoke, quick, or full.`))
        process.exit(1)
      }
    } else if (arg === '--tier') {
      const nextArg = args[i + 1]
      if (nextArg === 'smoke' || nextArg === 'quick' || nextArg === 'full') {
        tier = nextArg
        i++
      } else {
        console.error(red(`Invalid tier: ${nextArg}. Must be smoke, quick, or full.`))
        process.exit(1)
      }
    } else if (arg.startsWith('--config=')) {
      configFilter = arg.slice(9)
    } else if (arg === '--config') {
      configFilter = args[i + 1]
      i++
    }
  }

  if (showHelp) {
    printTestHelp()
    process.exit(0)
  }

  const cwd = process.cwd()
  const examplesDir = path.join(cwd, 'examples')

  if (!fs.existsSync(examplesDir)) {
    console.error(red('No examples/ directory found'))
    console.log(dim('Run this command from the bakery project root'))
    process.exit(1)
  }

  const configFiles = fs.readdirSync(examplesDir).filter((f) => f.endsWith('.json'))

  if (configFiles.length === 0) {
    console.error(red('No config files found in examples/'))
    process.exit(1)
  }

  let configs = configFiles.map((f) => path.join(examplesDir, f))

  if (configFilter) {
    const filtered = configs.filter((c) => path.basename(c, '.json') === configFilter)
    if (filtered.length === 0) {
      console.error(red(`Config not found: ${configFilter}`))
      console.log(`Available: ${configFiles.map((f) => path.basename(f, '.json')).join(', ')}`)
      process.exit(1)
    }
    configs = filtered
  }

  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-test-'))

  console.log(bold('Bakery Template Tests'))
  console.log(dim('─'.repeat(40)))
  console.log(`  Tier: ${tier}`)
  console.log(`  Configs: ${configs.length}`)
  console.log(`  Output: ${baseDir}`)

  const results: ValidationResult[] = []

  for (const configPath of configs) {
    const result = validateConfig(configPath, tier, baseDir)
    results.push(result)
  }

  printTestSummary(results)

  if (!keep) {
    fs.rmSync(baseDir, { recursive: true, force: true })
  } else {
    console.log(`\nGenerated projects kept at: ${baseDir}`)
  }

  const exitCode = results.every((r) => r.success) ? 0 : 1
  process.exit(exitCode)
}
