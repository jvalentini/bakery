import { execSync } from 'node:child_process'
import * as readline from 'node:readline'
import { blue, bold, cyan, dim, green, red, yellow } from '../utils/colors.js'

export type Archetype = 'cli' | 'library' | 'api' | 'full-stack' | 'convex-full-stack'

export type ApiFramework = 'hono' | 'express' | 'elysia'

export type WebFramework = 'react-vite' | 'nextjs' | 'vue' | 'tanstack-start'

export type ValidationStrategy = 'zod-neverthrow' | 'effect' | 'none'

export type Addon =
  | 'docker'
  | 'ci'
  | 'release'
  | 'dependabot'
  | 'docs'
  | 'security'
  | 'zod'
  | 'neverthrow'
  | 'effect'
  | 'convex'
  | 'tanstack-query'
  | 'tanstack-router'
  | 'tanstack-form'

export interface ProjectConfig {
  projectName: string
  description: string
  author: string
  license: 'MIT' | 'Apache-2.0' | 'ISC' | 'GPL-3.0' | 'BSD-3-Clause'
  githubUsername: string
  archetype: Archetype
  apiFramework: ApiFramework | undefined
  webFramework: WebFramework | undefined
  addons: Addon[]
}

let rl: readline.Interface | null = null

function getReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    })
  }
  return rl
}

function resetReadline(): void {
  if (rl) {
    rl.close()
    rl = null
  }
}

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const reader = getReadline()
    reader.question(prompt, (answer) => {
      resolve(answer.trim())
    })
  })
}

const ANSI = {
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine: '\x1b[2K',
  moveUp: (n: number) => `\x1b[${n}A`,
  moveToStart: '\r',
}

const KEYS = {
  up: '\x1b[A',
  down: '\x1b[B',
  enter: '\r',
  enterLF: '\n',
  space: ' ',
  ctrlC: '\x03',
  escape: '\x1b',
}

function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin
    const wasRaw = stdin.isRaw

    stdin.setRawMode(true)
    stdin.resume()
    stdin.once('data', (data) => {
      stdin.setRawMode(wasRaw ?? false)
      resolve(data.toString())
    })
  })
}

function renderSelectList(
  options: { label: string }[],
  cursor: number,
  selected?: Set<number>,
): void {
  const output = process.stderr

  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    if (!opt) continue

    const isCursor = i === cursor
    const isSelected = selected?.has(i)

    let marker: string
    if (selected !== undefined) {
      marker = isSelected ? green('◉') : dim('○')
    } else {
      marker = isCursor ? green('❯') : ' '
    }

    const label = isCursor ? bold(opt.label) : opt.label
    const prefix = isCursor ? cyan('›') : ' '

    output.write(`${ANSI.clearLine}  ${prefix} ${marker} ${label}\n`)
  }
}

function clearList(lineCount: number): void {
  const output = process.stderr
  output.write(ANSI.moveUp(lineCount))
  for (let i = 0; i < lineCount; i++) {
    output.write(`${ANSI.clearLine}\n`)
  }
  output.write(ANSI.moveUp(lineCount))
}

async function interactiveSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string }[],
  defaultIndex = 0,
): Promise<T> {
  const output = process.stderr
  let cursor = defaultIndex

  output.write(`\n${prompt}\n`)
  output.write(dim('  (Use arrow keys to navigate, Enter to select)\n\n'))
  output.write(ANSI.hideCursor)

  renderSelectList(options, cursor)

  try {
    while (true) {
      const key = await readKey()

      if (key === KEYS.ctrlC) {
        output.write(ANSI.showCursor)
        process.exit(0)
      }

      if (key === KEYS.enter || key === KEYS.enterLF) {
        output.write(ANSI.showCursor)
        const selected = options[cursor]
        if (selected) {
          clearList(options.length)
          output.write(`${ANSI.clearLine}  ${green('✓')} ${selected.label}\n`)
          resetReadline()
          return selected.value
        }
      }

      if (key === KEYS.up) {
        cursor = cursor > 0 ? cursor - 1 : options.length - 1
      } else if (key === KEYS.down) {
        cursor = cursor < options.length - 1 ? cursor + 1 : 0
      }

      clearList(options.length)
      renderSelectList(options, cursor)
    }
  } catch {
    output.write(ANSI.showCursor)
    resetReadline()
    throw new Error('Selection cancelled')
  }
}

async function interactiveMultiSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string; default?: boolean }[],
): Promise<T[]> {
  const output = process.stderr
  let cursor = 0
  const selected = new Set<number>()

  options.forEach((opt, i) => {
    if (opt.default) selected.add(i)
  })

  output.write(`\n${prompt}\n`)
  output.write(dim('  (Use arrow keys, Space to toggle, Enter to confirm)\n\n'))
  output.write(ANSI.hideCursor)

  renderSelectList(options, cursor, selected)

  try {
    while (true) {
      const key = await readKey()

      if (key === KEYS.ctrlC) {
        output.write(ANSI.showCursor)
        process.exit(0)
      }

      if (key === KEYS.enter || key === KEYS.enterLF) {
        output.write(ANSI.showCursor)
        clearList(options.length)
        const selectedOptions = options.filter((_, i) => selected.has(i))
        if (selectedOptions.length === 0) {
          output.write(`${ANSI.clearLine}  ${dim('(none selected)')}\n`)
        } else {
          for (const opt of selectedOptions) {
            output.write(`${ANSI.clearLine}  ${green('✓')} ${opt.label}\n`)
          }
        }
        resetReadline()
        return selectedOptions.map((o) => o.value)
      }

      if (key === KEYS.space) {
        if (selected.has(cursor)) {
          selected.delete(cursor)
        } else {
          selected.add(cursor)
        }
      }

      if (key === KEYS.up) {
        cursor = cursor > 0 ? cursor - 1 : options.length - 1
      } else if (key === KEYS.down) {
        cursor = cursor < options.length - 1 ? cursor + 1 : 0
      }

      clearList(options.length)
      renderSelectList(options, cursor, selected)
    }
  } catch {
    output.write(ANSI.showCursor)
    resetReadline()
    throw new Error('Selection cancelled')
  }
}

function detectGitUser(): { name: string | undefined; email: string | undefined } {
  try {
    const name = execSync('git config --get user.name', { encoding: 'utf8' }).trim()
    const email = execSync('git config --get user.email', { encoding: 'utf8' }).trim()
    return { name: name || undefined, email: email || undefined }
  } catch {
    return { name: undefined, email: undefined }
  }
}

function detectGithubUsername(): string | undefined {
  try {
    const result = execSync('gh auth status 2>/dev/null && gh api user --jq .login', {
      encoding: 'utf8',
    }).trim()
    return result || undefined
  } catch {
    return undefined
  }
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function validateProjectName(name: string): string | null {
  if (!name) return 'Project name is required'
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return 'Project name must start with a letter and contain only lowercase letters, numbers, and hyphens'
  }
  if (name.length > 214) return 'Project name must be 214 characters or less'
  return null
}

async function promptWithDefault(prompt: string, defaultValue: string): Promise<string> {
  const defaultHint = defaultValue ? dim(` (${defaultValue})`) : ''
  const answer = await question(`${prompt}${defaultHint}: `)
  return answer || defaultValue
}

async function promptRequired(
  prompt: string,
  validator?: (value: string) => string | null,
): Promise<string> {
  while (true) {
    const answer = await question(`${prompt}: `)
    if (!answer) {
      console.error(red('  This field is required'))
      continue
    }
    if (validator) {
      const error = validator(answer)
      if (error) {
        console.error(red(`  ${error}`))
        continue
      }
    }
    return answer
  }
}

async function promptSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string }[],
  defaultIndex = 0,
): Promise<T> {
  return interactiveSelect(prompt, options, defaultIndex)
}

async function promptConfirm(prompt: string, defaultValue = true): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]'
  const answer = await question(`${prompt} ${dim(hint)}: `)

  if (!answer) return defaultValue
  return answer.toLowerCase().startsWith('y')
}

async function promptMultiSelect<T extends string>(
  prompt: string,
  options: { value: T; label: string; default?: boolean }[],
): Promise<T[]> {
  return interactiveMultiSelect(prompt, options)
}

export async function runPrompts(): Promise<ProjectConfig> {
  console.error(`\n${bold(cyan('🥐 Bakery'))}\n`)
  console.error(dim('Bake fresh projects from recipes.\n'))
  console.error(dim('Press Ctrl+C to cancel at any time.\n'))

  const archetype = await promptSelect<Archetype>(
    bold(blue('🏗️  What are you building?')),
    [
      { value: 'cli', label: 'CLI Tool - Command-line applications' },
      { value: 'library', label: 'Library - Reusable npm/bun package' },
      { value: 'api', label: 'REST API - Backend service' },
      { value: 'full-stack', label: 'Full-Stack - Monorepo with API + Web' },
      { value: 'convex-full-stack', label: 'Convex App - Real-time app with TanStack Start' },
    ],
    0,
  )

  let apiFramework: ApiFramework | undefined
  let webFramework: WebFramework | undefined

  if (archetype === 'api' || archetype === 'full-stack') {
    apiFramework = await promptSelect<ApiFramework>(
      bold(blue('🔧 API Framework')),
      [
        { value: 'hono', label: 'Hono - Lightweight, fast, great with Bun' },
        { value: 'express', label: 'Express - Battle-tested, huge ecosystem' },
        { value: 'elysia', label: 'Elysia - Bun-native, TypeScript-first' },
      ],
      0,
    )
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
      0,
    )
  }

  if (archetype === 'convex-full-stack') {
    webFramework = 'tanstack-start'
  }

  const gitUser = detectGitUser()
  const detectedGithubUsername = detectGithubUsername()

  console.error(`\n${bold(blue('📦 Project Details'))}\n`)

  const rawName = await promptRequired('Project name (e.g., my-awesome-app)', validateProjectName)
  const projectName = toKebabCase(rawName)

  if (projectName !== rawName) {
    console.error(dim(`  → Using: ${projectName}`))
  }

  const defaultDescription = {
    cli: 'A CLI tool built with TypeScript and Bun',
    library: 'A reusable TypeScript library',
    api: 'A REST API built with TypeScript and Bun',
    'full-stack': 'A full-stack application built with TypeScript',
    'convex-full-stack': 'A real-time app with Convex and TanStack Start',
  }[archetype]

  const description = await promptWithDefault('Description', defaultDescription)
  const author = await promptWithDefault('Author name', gitUser.name || '')
  const githubUsername = await promptWithDefault('GitHub username', detectedGithubUsername || '')

  const license = await promptSelect<ProjectConfig['license']>(
    bold(blue('📄 License')),
    [
      { value: 'MIT', label: 'MIT - Simple and permissive' },
      { value: 'Apache-2.0', label: 'Apache 2.0 - Permissive with patent grant' },
      { value: 'ISC', label: 'ISC - Simplified MIT' },
      { value: 'GPL-3.0', label: 'GPL 3.0 - Copyleft' },
      { value: 'BSD-3-Clause', label: 'BSD 3-Clause - Permissive' },
    ],
    0,
  )

  const addons: Addon[] = []

  if (archetype !== 'convex-full-stack') {
    const validationStrategy = await promptSelect<ValidationStrategy>(
      bold(blue('🔒 Validation & Error Handling')),
      [
        {
          value: 'zod-neverthrow',
          label: 'Zod + neverthrow - Simple, widely adopted',
        },
        {
          value: 'effect',
          label: 'Effect-ts - Powerful functional programming',
        },
        {
          value: 'none',
          label: "None - I'll add my own",
        },
      ],
      0,
    )

    if (validationStrategy === 'zod-neverthrow') {
      addons.push('zod', 'neverthrow')
    } else if (validationStrategy === 'effect') {
      addons.push('effect')
    }
  } else {
    const useEffect = await promptConfirm('Include Effect-ts for type-safe business logic?', false)
    if (useEffect) {
      addons.push('effect')
    }
  }

  const devOpsOptions: { value: Addon; label: string; default?: boolean }[] = [
    { value: 'docker', label: 'Docker - Containerized development', default: true },
    { value: 'ci', label: 'GitHub Actions CI - Automated testing', default: true },
    { value: 'docs', label: 'TypeDoc - API documentation', default: true },
    { value: 'security', label: 'Trivy - Security scanning', default: true },
  ]

  if (archetype === 'cli') {
    devOpsOptions.push({
      value: 'release',
      label: 'Release workflow - Auto-build binaries',
      default: true,
    })
  }

  const devOpsAddons = await promptMultiSelect<Addon>(
    bold(blue('🛠️  DevOps & Tooling')),
    devOpsOptions,
  )
  addons.push(...devOpsAddons)

  if (addons.includes('ci')) {
    const includeDependabot = await promptConfirm(
      'Include Dependabot (automated dependency updates)?',
      true,
    )
    if (includeDependabot) {
      addons.push('dependabot')
    }
  }

  if (archetype === 'full-stack' && webFramework !== 'nextjs') {
    const tanstackOptions: { value: Addon; label: string; default?: boolean }[] = [
      { value: 'tanstack-query', label: 'TanStack Query - Data fetching & caching', default: true },
      { value: 'tanstack-router', label: 'TanStack Router - Type-safe routing', default: false },
      { value: 'tanstack-form', label: 'TanStack Form - Form management', default: false },
    ]

    const tanstackAddons = await promptMultiSelect<Addon>(
      bold(blue('📦 TanStack Libraries')),
      tanstackOptions,
    )
    addons.push(...tanstackAddons)
  }

  if (archetype === 'api' || archetype === 'full-stack') {
    const includeConvex = await promptConfirm('Include Convex real-time database?', false)
    if (includeConvex) {
      addons.push('convex')
    }
  }

  if (archetype === 'convex-full-stack') {
    addons.push('convex', 'tanstack-query')
  }

  console.error(`\n${bold(green('✓ Configuration complete!'))}\n`)

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
  }
}

export function closePrompts(): void {
  resetReadline()
}

const archetypeLabels: Record<Archetype, string> = {
  cli: 'CLI Tool',
  library: 'Library',
  api: 'REST API',
  'full-stack': 'Full-Stack',
  'convex-full-stack': 'Convex Full-Stack',
}

const frameworkLabels: Record<string, string> = {
  hono: 'Hono',
  express: 'Express',
  elysia: 'Elysia',
  'react-vite': 'React (Vite)',
  nextjs: 'Next.js',
  vue: 'Vue',
  'tanstack-start': 'TanStack Start',
}

export function printSummary(config: ProjectConfig, outputDir: string): void {
  console.error(bold(cyan('\n📋 Summary\n')))
  console.error(`  ${dim('Project:')}     ${config.projectName}`)
  console.error(`  ${dim('Type:')}        ${archetypeLabels[config.archetype]}`)
  if (config.apiFramework) {
    console.error(`  ${dim('API:')}         ${frameworkLabels[config.apiFramework]}`)
  }
  if (config.webFramework) {
    console.error(`  ${dim('Web:')}         ${frameworkLabels[config.webFramework]}`)
  }
  console.error(`  ${dim('Description:')} ${config.description}`)
  if (config.author) console.error(`  ${dim('Author:')}      ${config.author}`)
  if (config.githubUsername) console.error(`  ${dim('GitHub:')}      ${config.githubUsername}`)
  console.error(`  ${dim('License:')}     ${config.license}`)

  console.error(bold(cyan('\n🔒 Validation\n')))
  const hasAddon = (addon: Addon) => config.addons.includes(addon)
  if (hasAddon('effect')) {
    console.error(`  ${green('Effect-ts')} - Type-safe functional programming`)
  } else if (hasAddon('zod') && hasAddon('neverthrow')) {
    console.error(`  ${green('Zod + neverthrow')} - Simple validation & error handling`)
  } else if (hasAddon('zod')) {
    console.error(`  ${green('Zod')} - Runtime type validation`)
  } else {
    console.error(`  ${dim('None selected')}`)
  }

  console.error(bold(cyan('\n🛠️  DevOps\n')))
  console.error(`  ${dim('Docker:')}      ${hasAddon('docker') ? green('Yes') : yellow('No')}`)
  console.error(`  ${dim('CI:')}          ${hasAddon('ci') ? green('Yes') : yellow('No')}`)
  if (hasAddon('ci')) {
    console.error(`  ${dim('Release:')}     ${hasAddon('release') ? green('Yes') : yellow('No')}`)
    console.error(
      `  ${dim('Dependabot:')}  ${hasAddon('dependabot') ? green('Yes') : yellow('No')}`,
    )
  }
  console.error(`  ${dim('Docs:')}        ${hasAddon('docs') ? green('Yes') : yellow('No')}`)
  console.error(`  ${dim('Security:')}    ${hasAddon('security') ? green('Yes') : yellow('No')}`)

  if (
    hasAddon('convex') ||
    hasAddon('tanstack-query') ||
    hasAddon('tanstack-router') ||
    hasAddon('tanstack-form')
  ) {
    console.error(bold(cyan('\n📦 Integrations\n')))
    if (hasAddon('convex')) console.error(`  ${green('✓')} Convex`)
    if (hasAddon('tanstack-query')) console.error(`  ${green('✓')} TanStack Query`)
    if (hasAddon('tanstack-router')) console.error(`  ${green('✓')} TanStack Router`)
    if (hasAddon('tanstack-form')) console.error(`  ${green('✓')} TanStack Form`)
  }

  console.error(`\n  ${dim('Output:')}      ${outputDir}`)
}
