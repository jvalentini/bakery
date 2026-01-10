import * as fs from 'node:fs'
import * as path from 'node:path'
import { err, ok, type Result } from 'neverthrow'
import { bold, dim, green, red, yellow } from '../utils/colors.js'

export interface LintError {
  type: 'error' | 'warning'
  file: string
  message: string
  line?: number
}

export interface LintResult {
  template: string
  errors: LintError[]
  warnings: LintError[]
}

export interface LintSummary {
  results: LintResult[]
  totalErrors: number
  totalWarnings: number
}

interface TemplateManifest {
  name: string
  displayName?: string
  description?: string
  version?: string
  dependencies?: string[]
  files?: string[]
  [key: string]: unknown
}

function validateJson(filePath: string): Result<unknown, LintError> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    return ok(parsed)
  } catch (e) {
    const message = e instanceof SyntaxError ? e.message : 'Invalid JSON'
    return err({
      type: 'error',
      file: filePath,
      message: `Invalid JSON: ${message}`,
    })
  }
}

function validateEjsSyntax(filePath: string): LintError[] {
  const errors: LintError[] = []

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    let openTags = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line === undefined) continue

      const lineNum = i + 1

      const openMatches = line.match(/<%[^%]/g) || []
      const closeMatches = line.match(/%>/g) || []
      openTags += openMatches.length - closeMatches.length

      const ejsContent = line.match(/<%[=_-]?\s*(.*?)\s*%>/g)
      if (ejsContent) {
        for (const tag of ejsContent) {
          if (tag.includes('<%=') && tag.trim() === '<%=%>') {
            errors.push({
              type: 'error',
              file: filePath,
              message: 'Empty EJS expression',
              line: lineNum,
            })
          }
        }
      }

      if (line.includes('< %') || line.includes('% >')) {
        errors.push({
          type: 'warning',
          file: filePath,
          message: 'Possible malformed EJS tag (space between < and % or % and >)',
          line: lineNum,
        })
      }
    }

    if (openTags !== 0) {
      errors.push({
        type: 'error',
        file: filePath,
        message: `Unbalanced EJS tags: ${openTags > 0 ? 'unclosed' : 'extra closing'} tag(s)`,
      })
    }
  } catch (e) {
    errors.push({
      type: 'error',
      file: filePath,
      message: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`,
    })
  }

  return errors
}

function validateTemplateManifest(manifestPath: string): LintError[] {
  const errors: LintError[] = []

  const jsonResult = validateJson(manifestPath)
  if (jsonResult.isErr()) {
    errors.push(jsonResult.error)
    return errors
  }

  const manifest = jsonResult.value as TemplateManifest

  if (!manifest.name) {
    errors.push({
      type: 'error',
      file: manifestPath,
      message: 'Missing required field: name',
    })
  }

  if (!manifest.description) {
    errors.push({
      type: 'warning',
      file: manifestPath,
      message: 'Missing recommended field: description',
    })
  }

  if (!manifest.version) {
    errors.push({
      type: 'warning',
      file: manifestPath,
      message: 'Missing recommended field: version',
    })
  }

  return errors
}

function findTemplates(templatesDir: string): string[] {
  const templates: string[] = []

  if (!fs.existsSync(templatesDir)) {
    return templates
  }

  for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const templateJson = path.join(templatesDir, entry.name, 'template.json')
      if (fs.existsSync(templateJson)) {
        templates.push(path.join(templatesDir, entry.name))
      }

      const nestedDir = path.join(templatesDir, entry.name)
      for (const nested of fs.readdirSync(nestedDir, { withFileTypes: true })) {
        if (nested.isDirectory()) {
          const nestedTemplateJson = path.join(nestedDir, nested.name, 'template.json')
          if (fs.existsSync(nestedTemplateJson)) {
            templates.push(path.join(nestedDir, nested.name))
          }
        }
      }
    }
  }

  return templates
}

function findEjsFiles(dir: string): string[] {
  const files: string[] = []

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.ejs')) {
        files.push(fullPath)
      }
    }
  }

  walk(dir)
  return files
}

function lintTemplate(templateDir: string): LintResult {
  const templateName = path.basename(templateDir)
  const errors: LintError[] = []
  const warnings: LintError[] = []

  const manifestPath = path.join(templateDir, 'template.json')
  if (fs.existsSync(manifestPath)) {
    const manifestErrors = validateTemplateManifest(manifestPath)
    for (const e of manifestErrors) {
      if (e.type === 'error') {
        errors.push(e)
      } else {
        warnings.push(e)
      }
    }
  } else {
    errors.push({
      type: 'error',
      file: manifestPath,
      message: 'Missing template.json',
    })
  }

  const ejsFiles = findEjsFiles(templateDir)
  for (const ejsFile of ejsFiles) {
    const ejsErrors = validateEjsSyntax(ejsFile)
    for (const e of ejsErrors) {
      if (e.type === 'error') {
        errors.push(e)
      } else {
        warnings.push(e)
      }
    }
  }

  function findJsonFiles(dir: string): string[] {
    const jsonFiles: string[] = []
    function walkJson(currentDir: string): void {
      if (!fs.existsSync(currentDir)) return
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          walkJson(fullPath)
        } else if (entry.name.endsWith('.json') && entry.name !== 'template.json') {
          jsonFiles.push(fullPath)
        }
      }
    }
    walkJson(dir)
    return jsonFiles
  }

  const jsonFiles = findJsonFiles(templateDir)
  for (const jsonFile of jsonFiles) {
    const result = validateJson(jsonFile)
    if (result.isErr()) {
      errors.push(result.error)
    }
  }

  return {
    template: templateName,
    errors,
    warnings,
  }
}

function printLintResult(result: LintResult, cwd: string): void {
  const hasIssues = result.errors.length > 0 || result.warnings.length > 0

  if (hasIssues) {
    console.log(`\n${bold(result.template)}`)

    for (const e of result.errors) {
      const relPath = path.relative(cwd, e.file)
      const location = e.line ? `:${e.line}` : ''
      console.log(`  ${red('error')} ${relPath}${location}`)
      console.log(`    ${e.message}`)
    }

    for (const w of result.warnings) {
      const relPath = path.relative(cwd, w.file)
      const location = w.line ? `:${w.line}` : ''
      console.log(`  ${yellow('warning')} ${relPath}${location}`)
      console.log(`    ${w.message}`)
    }
  }
}

function printLintSummary(summary: LintSummary): void {
  console.log('')
  console.log(dim('─'.repeat(40)))

  const templatesWithIssues = summary.results.filter(
    (r) => r.errors.length > 0 || r.warnings.length > 0,
  ).length

  if (summary.totalErrors === 0 && summary.totalWarnings === 0) {
    console.log(green(`${bold('All templates passed')} (${summary.results.length} checked)`))
  } else {
    console.log(`${bold('Summary')}: ${summary.results.length} templates checked`)

    if (templatesWithIssues > 0) {
      console.log(`  ${dim('Templates with issues:')} ${templatesWithIssues}`)
    }

    if (summary.totalErrors > 0) {
      console.log(`  ${red(`Errors: ${summary.totalErrors}`)}`)
    }

    if (summary.totalWarnings > 0) {
      console.log(`  ${yellow(`Warnings: ${summary.totalWarnings}`)}`)
    }
  }
}

export function printLintHelp(): void {
  console.log(`
${bold('bakery lint')} - Lint Bakery templates

${bold('USAGE:')}
  bakery lint [options] [path]

${bold('ARGUMENTS:')}
  path                  Path to template or templates directory (default: ./templates)

${bold('OPTIONS:')}
  --strict              Fail on warnings (exit code 1)
  -h, --help            Show this help message

${bold('CHECKS:')}
  ${green('•')} Valid JSON in template.json and other JSON files
  ${green('•')} EJS syntax validation
  ${green('•')} Required fields in template.json

${bold('EXAMPLES:')}
  ${dim('# Lint all templates')}
  bakery lint

  ${dim('# Lint a specific template')}
  bakery lint templates/cli

  ${dim('# Lint with strict mode (fail on warnings)')}
  bakery lint --strict
`)
}

export async function handleLintCommand(args: string[]): Promise<void> {
  let targetPath: string | undefined
  let strict = false
  let showHelp = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--strict') {
      strict = true
    } else if (arg === '-h' || arg === '--help') {
      showHelp = true
    } else if (arg && !arg.startsWith('-')) {
      targetPath = arg
    }
  }

  if (showHelp) {
    printLintHelp()
    process.exit(0)
  }

  const cwd = process.cwd()
  const defaultTemplatesDir = path.join(cwd, 'templates')

  let templates: string[] = []

  if (targetPath) {
    const absolutePath = path.resolve(cwd, targetPath)

    if (!fs.existsSync(absolutePath)) {
      console.error(red(`Path not found: ${targetPath}`))
      process.exit(1)
    }

    const templateJson = path.join(absolutePath, 'template.json')
    if (fs.existsSync(templateJson)) {
      templates = [absolutePath]
    } else {
      templates = findTemplates(absolutePath)
    }
  } else {
    templates = findTemplates(defaultTemplatesDir)
  }

  if (templates.length === 0) {
    console.error(red('No templates found'))
    console.log(dim(`Searched in: ${targetPath ?? defaultTemplatesDir}`))
    process.exit(1)
  }

  console.log(bold('Linting templates...'))
  console.log(dim(`Found ${templates.length} template(s)`))

  const results: LintResult[] = []

  for (const template of templates) {
    const result = lintTemplate(template)
    results.push(result)
    printLintResult(result, cwd)
  }

  const summary: LintSummary = {
    results,
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
  }

  printLintSummary(summary)

  if (summary.totalErrors > 0) {
    process.exit(1)
  }

  if (strict && summary.totalWarnings > 0) {
    console.log(dim('\n--strict mode: failing due to warnings'))
    process.exit(1)
  }

  process.exit(0)
}
