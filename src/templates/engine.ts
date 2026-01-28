import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ejs from 'ejs'

/**
 * Context passed to EJS templates during rendering
 */
export interface TemplateContext {
  // Project basics
  projectName: string
  projectNamePascal: string
  projectNameCamel: string
  description: string
  author: string
  license: string
  year: number

  // GitHub
  githubUsername: string
  githubUrl: string

  // Archetype
  archetype: string
  apiFramework: string | undefined
  webFramework: string | undefined

  // Feature flags
  addons: string[]
  hasAddon: (name: string) => boolean

  // Helpers
  kebabCase: (str: string) => string
  pascalCase: (str: string) => string
  camelCase: (str: string) => string
}

/**
 * Options for template rendering
 */
export interface RenderOptions {
  /** Base directory for resolving includes/partials */
  basePath?: string
  /** Additional data to merge into context */
  data?: Record<string, unknown>
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Create a template context from project configuration
 */
export function createTemplateContext(config: {
  projectName: string
  description: string
  author: string
  license: string
  githubUsername: string
  archetype: string
  apiFramework: string | undefined
  webFramework: string | undefined
  addons: string[]
}): TemplateContext {
  const githubUrl = config.githubUsername
    ? `https://github.com/${config.githubUsername}/${config.projectName}`
    : ''

  return {
    projectName: config.projectName,
    projectNamePascal: toPascalCase(config.projectName),
    projectNameCamel: toCamelCase(config.projectName),
    description: config.description,
    author: config.author,
    license: config.license,
    year: new Date().getFullYear(),
    githubUsername: config.githubUsername,
    githubUrl,
    archetype: config.archetype,
    apiFramework: config.apiFramework,
    webFramework: config.webFramework,
    addons: config.addons,
    hasAddon: (name: string) => config.addons.includes(name),
    kebabCase: toKebabCase,
    pascalCase: toPascalCase,
    camelCase: toCamelCase,
  }
}

/**
 * Render an EJS template string with the given context
 */
export function renderTemplate(
  template: string,
  context: TemplateContext,
  options: RenderOptions = {},
): string {
  const ejsOptions: ejs.Options = {
    async: false,
  }

  if (options.basePath) {
    ejsOptions.root = options.basePath
    ejsOptions.views = [options.basePath]
  }

  const data = { ...context, ...options.data }

  // ejs.render with async: false returns string synchronously
  const result = ejs.render(template, data, ejsOptions)
  return result as string
}

/**
 * Render an EJS template file with the given context
 */
export function renderTemplateFile(
  templatePath: string,
  context: TemplateContext,
  options: RenderOptions = {},
): string {
  const template = fs.readFileSync(templatePath, 'utf-8')
  const basePath = options.basePath ?? path.dirname(templatePath)

  return renderTemplate(template, context, { ...options, basePath })
}

/**
 * Process a directory of templates, rendering each .ejs file
 * Returns a map of output paths to rendered content
 */
export function processTemplateDirectory(
  templateDir: string,
  context: TemplateContext,
  options: RenderOptions = {},
): Map<string, string> {
  const results = new Map<string, string>()

  function processDir(dir: string, relativePath: string = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.join(relativePath, entry.name)

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        processDir(fullPath, relPath)
      } else if (entry.isFile()) {
        let outputPath = relPath
        let content: string

        if (entry.name.endsWith('.ejs')) {
          // Render EJS template and remove .ejs extension
          outputPath = relPath.slice(0, -4)
          content = renderTemplateFile(fullPath, context, {
            ...options,
            basePath: templateDir,
          })
        } else {
          // Copy non-template files as-is
          content = fs.readFileSync(fullPath, 'utf-8')
        }

        // Process output path for template variables (e.g., {{projectName}}.ts)
        outputPath = outputPath
          .replace(/\{\{projectName\}\}/g, context.projectName)
          .replace(/\{\{projectNamePascal\}\}/g, context.projectNamePascal)

        results.set(outputPath, content)
      }
    }
  }

  processDir(templateDir)
  return results
}

/**
 * Write processed templates to the output directory
 */
export function writeTemplates(templates: Map<string, string>, outputDir: string): void {
  for (const [relativePath, content] of templates) {
    // Skip writing empty files (templates that render to empty content for unsupported frameworks)
    if (!content.trim()) {
      continue
    }

    const fullPath = path.join(outputDir, relativePath)
    const dir = path.dirname(fullPath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(fullPath, content, 'utf-8')
  }
}
