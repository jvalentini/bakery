#!/usr/bin/env bun

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { loadConfigFile } from '../src/config/index.js'
import { generateProject } from '../src/wizard/generator.js'

type Tier = 'smoke' | 'quick' | 'full'

// These templates require codegen (like convex dev or vinxi dev) before typecheck passes
const SKIP_QUICK_FULL = new Set([
  'full-stack-tanstack', // TanStack Start needs route tree generation
])

interface ValidationResult {
  config: string
  tier: Tier
  success: boolean
  duration: number
  errors: string[]
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

function log(message: string): void {
  console.error(message)
}

function success(message: string): void {
  log(`${COLORS.green}${COLORS.bold}PASS${COLORS.reset} ${message}`)
}

function fail(message: string): void {
  log(`${COLORS.red}${COLORS.bold}FAIL${COLORS.reset} ${message}`)
}

function info(message: string): void {
  log(`${COLORS.blue}INFO${COLORS.reset} ${message}`)
}

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

function validateSmoke(projectDir: string, _configName: string): string[] {
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

  info('  Running bun install...')
  const installResult = runCommand(projectDir, 'bun install')
  if (!installResult.success) {
    errors.push(`bun install failed: ${installResult.output.slice(0, 500)}`)
    return errors
  }

  info('  Running typecheck...')
  const typecheckResult = runCommand(projectDir, 'bun run typecheck')
  if (!typecheckResult.success) {
    errors.push(`typecheck failed: ${typecheckResult.output.slice(0, 500)}`)
  }

  return errors
}

function validateFull(projectDir: string): string[] {
  const errors: string[] = []

  info('  Running make check...')
  const checkResult = runCommand(projectDir, 'make check')
  if (!checkResult.success) {
    errors.push(`make check failed: ${checkResult.output.slice(0, 500)}`)
  }

  info('  Running make test...')
  const testResult = runCommand(projectDir, 'bun test')
  if (!testResult.success) {
    errors.push(`make test failed: ${testResult.output.slice(0, 500)}`)
  }

  info('  Running make build...')
  const buildResult = runCommand(projectDir, 'bun run build')
  if (!buildResult.success) {
    errors.push(`make build failed: ${buildResult.output.slice(0, 500)}`)
  }

  return errors
}

function validateConfig(configPath: string, tier: Tier, baseDir: string): ValidationResult {
  const configName = path.basename(configPath, '.json')
  const startTime = Date.now()
  const errors: string[] = []

  log(`\n${COLORS.bold}Validating: ${configName}${COLORS.reset} (tier: ${tier})`)

  const configResult = loadConfigFile(configPath)
  if (configResult.isErr()) {
    errors.push(`Failed to load config: ${configResult.error}`)
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
    info('  Generating project...')
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

  info('  Running smoke checks...')
  errors.push(...validateSmoke(projectDir, configName))

  if (tier === 'quick' || tier === 'full') {
    if (errors.length === 0) {
      if (SKIP_QUICK_FULL.has(configName)) {
        info('  Skipping quick/full (requires codegen)')
      } else {
        errors.push(...validateQuick(projectDir))
      }
    }
  }

  if (tier === 'full') {
    if (errors.length === 0 && !SKIP_QUICK_FULL.has(configName)) {
      errors.push(...validateFull(projectDir))
    }
  }

  const duration = Date.now() - startTime
  const isSuccess = errors.length === 0

  if (isSuccess) {
    success(`${configName} (${duration}ms)`)
  } else {
    fail(`${configName} (${duration}ms)`)
    for (const error of errors) {
      log(`  ${COLORS.red}-${COLORS.reset} ${error}`)
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

function printSummary(results: ValidationResult[]): void {
  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  log(`\n${COLORS.bold}Summary${COLORS.reset}`)
  log(`${'─'.repeat(40)}`)
  log(`Total: ${results.length} configs`)
  log(`${COLORS.green}Passed: ${passed}${COLORS.reset}`)
  if (failed > 0) {
    log(`${COLORS.red}Failed: ${failed}${COLORS.reset}`)
  }
  log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`)

  if (failed > 0) {
    log(`\n${COLORS.red}${COLORS.bold}Failed configs:${COLORS.reset}`)
    for (const result of results.filter((r) => !r.success)) {
      log(`  - ${result.config}`)
    }
  }
}

function printUsage(): void {
  log(`
Usage: bun run scripts/validate-archetypes.ts [options]

Options:
  --tier <smoke|quick|full>  Validation tier (default: smoke)
  --config <name>            Validate specific config only
  --keep                     Keep generated projects (don't cleanup)
  --help                     Show this help message

Tiers:
  smoke   Generate + file existence + valid JSON (~5s)
  quick   Above + bun install + typecheck (~60s)
  full    Above + make check + test + build (~5-10min)

Examples:
  bun run scripts/validate-archetypes.ts
  bun run scripts/validate-archetypes.ts --tier=quick
  bun run scripts/validate-archetypes.ts --tier=full --config=cli
  bun run scripts/validate-archetypes.ts --tier=full --keep
`)
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tier: { type: 'string', default: 'smoke' },
      config: { type: 'string' },
      keep: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    printUsage()
    process.exit(0)
  }

  const tier = values.tier as Tier
  if (!['smoke', 'quick', 'full'].includes(tier)) {
    log(`Invalid tier: ${tier}. Must be smoke, quick, or full.`)
    process.exit(1)
  }

  const examplesDir = path.join(import.meta.dirname, '..', 'examples')
  const configFiles = fs.readdirSync(examplesDir).filter((f) => f.endsWith('.json'))

  if (configFiles.length === 0) {
    log('No config files found in examples/')
    process.exit(1)
  }

  let configs = configFiles.map((f) => path.join(examplesDir, f))

  if (values.config) {
    const filtered = configs.filter((c) => path.basename(c, '.json') === values.config)
    if (filtered.length === 0) {
      log(`Config not found: ${values.config}`)
      log(`Available: ${configFiles.map((f) => path.basename(f, '.json')).join(', ')}`)
      process.exit(1)
    }
    configs = filtered
  }

  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-validate-'))

  log(`${COLORS.bold}Bakery Archetype Validation${COLORS.reset}`)
  log(`${'─'.repeat(40)}`)
  log(`Tier: ${tier}`)
  log(`Configs: ${configs.length}`)
  log(`Output: ${baseDir}`)

  const results: ValidationResult[] = []

  for (const configPath of configs) {
    const result = validateConfig(configPath, tier, baseDir)
    results.push(result)
  }

  printSummary(results)

  if (!values.keep) {
    fs.rmSync(baseDir, { recursive: true, force: true })
  } else {
    log(`\nGenerated projects kept at: ${baseDir}`)
  }

  const exitCode = results.every((r) => r.success) ? 0 : 1
  process.exit(exitCode)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
