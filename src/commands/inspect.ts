import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseMarkers } from '../inject/parser.js'
import { loadManifest, type Manifest } from '../sync/manifest.js'
import { bold, cyan, dim, green, red, yellow } from '../utils/colors.js'

interface InjectionPoint {
  file: string
  marker: string
  line: number
  indent: string
  hasContent: boolean
  injectedBy?: string
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.bakery'])

const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.vue',
  '.svelte',
  '.yml',
  '.yaml',
  '.json',
  '.md',
  '.xml',
  '.svg',
  '.ejs',
])

function scanFileForMarkers(filePath: string): InjectionPoint[] {
  const points: InjectionPoint[] = []

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const result = parseMarkers(content, filePath)

    if (result.isOk()) {
      for (const [name, region] of result.value) {
        const regionContent = content.slice(region.contentStartIndex, region.contentEndIndex).trim()
        points.push({
          file: filePath,
          marker: name,
          line: region.startLine + 1,
          indent: region.indent,
          hasContent: regionContent.length > 0,
        })
      }
    }
  } catch {
    // Expected for binary/unreadable files
  }

  return points
}

function scanDirectory(dir: string, basePath: string = ''): InjectionPoint[] {
  const points: InjectionPoint[] = []

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) {
        continue
      }

      const fullPath = path.join(dir, entry.name)
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        points.push(...scanDirectory(fullPath, relativePath))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()

        if (SCANNABLE_EXTENSIONS.has(ext)) {
          const filePoints = scanFileForMarkers(fullPath)
          for (const point of filePoints) {
            point.file = relativePath
          }
          points.push(...filePoints)
        }
      }
    }
  } catch {
    // Directory may not be readable
  }

  return points
}

function enrichWithManifest(points: InjectionPoint[], manifest: Manifest): void {
  for (const point of points) {
    const fileEntry = manifest.files[point.file]
    if (fileEntry?.injections) {
      for (const injection of fileEntry.injections) {
        if (injection.marker === point.marker) {
          point.injectedBy = injection.addon
        }
      }
    }
  }
}

export async function listInjections(
  projectDir: string,
  options: { json?: boolean },
): Promise<void> {
  const resolvedDir = path.resolve(projectDir)

  if (!fs.existsSync(resolvedDir)) {
    console.error(red(`Directory not found: ${resolvedDir}`))
    process.exit(1)
  }

  const points = scanDirectory(resolvedDir)

  const manifestResult = loadManifest(resolvedDir)
  if (manifestResult.isOk()) {
    enrichWithManifest(points, manifestResult.value)
  }

  if (options.json) {
    console.log(JSON.stringify(points, null, 2))
    return
  }

  if (points.length === 0) {
    console.log(dim('No injection points found in this project.'))
    console.log('')
    console.log(dim('Injection markers look like:'))
    console.log(dim('  // BAKERY:INJECT:marker-name'))
    console.log(dim('  // BAKERY:END:marker-name'))
    return
  }

  const byFile = new Map<string, InjectionPoint[]>()
  for (const point of points) {
    const existing = byFile.get(point.file) ?? []
    existing.push(point)
    byFile.set(point.file, existing)
  }

  console.log(bold('Injection Points'))
  console.log('')

  for (const [file, filePoints] of byFile) {
    console.log(`${cyan(file)}`)

    for (const point of filePoints) {
      const status = point.hasContent
        ? point.injectedBy
          ? green(`✓ ${point.injectedBy}`)
          : yellow('● has content')
        : dim('○ empty')

      console.log(`  ${dim(`L${point.line}`)} ${bold(point.marker)} ${status}`)
    }
    console.log('')
  }

  const total = points.length
  const filled = points.filter((p) => p.hasContent).length
  const empty = total - filled

  console.log(dim('─'.repeat(40)))
  console.log(`${bold('Total:')} ${total} injection point${total !== 1 ? 's' : ''}`)
  console.log(`  ${green('●')} ${filled} with content`)
  console.log(`  ${dim('○')} ${empty} empty`)
}

export async function showFileMarkers(filePath: string): Promise<void> {
  const resolvedPath = path.resolve(filePath)

  if (!fs.existsSync(resolvedPath)) {
    console.error(red(`File not found: ${resolvedPath}`))
    process.exit(1)
  }

  const points = scanFileForMarkers(resolvedPath)

  if (points.length === 0) {
    console.log(dim(`No injection markers found in ${filePath}`))
    return
  }

  console.log(bold(`Injection markers in ${cyan(filePath)}`))
  console.log('')

  for (const point of points) {
    const status = point.hasContent ? yellow('● has content') : dim('○ empty')
    console.log(`  ${dim(`L${point.line}`)} ${bold(point.marker)} ${status}`)
  }
}

export function printInspectHelp(): void {
  console.log(`
${bold('bakery inspect')} - Inspect generated projects

${bold('USAGE:')}
  bakery inspect [options] [path]

${bold('OPTIONS:')}
  --json               Output as JSON
  -h, --help           Show this help message

${bold('EXAMPLES:')}
  ${dim('# List injection points in current directory')}
  bakery inspect

  ${dim('# List injection points in a specific project')}
  bakery inspect ./my-project

  ${dim('# Output as JSON for scripting')}
  bakery inspect --json

  ${dim('# Show markers in a specific file')}
  bakery inspect src/cli.ts

${bold('INJECTION MARKERS:')}
  Markers define where addons can inject code:
  
  ${dim('// BAKERY:INJECT:imports')}
  ${dim('import { something } from "addon"  ← injected content')}
  ${dim('// BAKERY:END:imports')}

${bold('MARKER STATUS:')}
  ${green('✓ addon-name')}  Injected by an addon
  ${yellow('● has content')}  Contains code (source unknown)
  ${dim('○ empty')}        No content between markers
`)
}

export async function handleInspectCommand(args: string[]): Promise<void> {
  let pathArg: string | undefined
  let jsonOutput = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '-h' || arg === '--help' || arg === 'help') {
      printInspectHelp()
      return
    }

    if (arg === '--json') {
      jsonOutput = true
      continue
    }

    if (arg && !arg.startsWith('-')) {
      pathArg = arg
    }
  }

  const targetPath = pathArg ?? '.'
  const resolvedPath = path.resolve(targetPath)

  if (!fs.existsSync(resolvedPath)) {
    console.error(red(`Path not found: ${resolvedPath}`))
    process.exit(1)
  }

  const stats = fs.statSync(resolvedPath)

  if (stats.isFile()) {
    await showFileMarkers(targetPath)
  } else {
    await listInjections(targetPath, { json: jsonOutput })
  }
}
