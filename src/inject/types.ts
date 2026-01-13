import { z } from 'zod'

/**
 * Comment style for different file types
 */
export type CommentStyle = 'js' | 'python' | 'html' | 'css'

/**
 * Position for injection within a marker region
 */
export const InjectionPositionSchema = z.enum(['start', 'end'])
export type InjectionPosition = z.infer<typeof InjectionPositionSchema>

/**
 * Schema for injection definitions in template.json
 */
export const InjectionDefinitionSchema = z
  .object({
    /** Target file path relative to project root */
    file: z.string().min(1).describe('Target file path relative to project root'),

    /** Marker name (lowercase alphanumeric with hyphens) - required for text injection, not for JSON */
    marker: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Marker name must be lowercase alphanumeric with hyphens')
      .optional()
      .describe('Marker name to inject into (required for text injection)'),

    /** Literal content to inject */
    content: z.string().optional().describe('Literal content to inject'),

    /** EJS template file for content (relative to addon directory) */
    template: z.string().optional().describe('EJS template file for injection content'),

    /** JSON to merge (for package.json, tsconfig, etc.) */
    json: z.record(z.string(), z.unknown()).optional().describe('JSON to deep merge'),

    /** JSON path for targeting (e.g., "$.scripts") - used with json field */
    jsonPath: z.string().optional().describe('JSON path for targeting (e.g., "$.scripts")'),

    /** Where in marker region to inject (default: "end") */
    position: InjectionPositionSchema.default('end').describe('Position within marker region'),

    /** Add trailing newline (default: true) */
    newline: z.boolean().default(true).describe('Add trailing newline after injection'),

    /** Match marker indentation (default: true) */
    indent: z.boolean().default(true).describe('Match marker indentation'),
  })
  .refine(
    (data) => data.content !== undefined || data.template !== undefined || data.json !== undefined,
    {
      message: 'One of content, template, or json is required',
    },
  )
  .refine((data) => !(data.json !== undefined && data.marker !== undefined), {
    message: 'JSON injection should not use markers, use jsonPath instead',
  })
  .refine((data) => !(data.json === undefined && data.marker === undefined), {
    message: 'Text injection requires a marker',
  })

export type InjectionDefinition = z.infer<typeof InjectionDefinitionSchema>

/**
 * Represents a marker region in a file
 */
export interface MarkerRegion {
  /** Marker name (e.g., "routes", "middleware") */
  name: string

  /** Line number where INJECT marker starts (0-based) */
  startLine: number

  /** Line number where END marker is (0-based) */
  endLine: number

  /** Character index in file content where region starts (after INJECT line) */
  contentStartIndex: number

  /** Character index in file content where region ends (before END line) */
  contentEndIndex: number

  /** Indentation string from the marker line */
  indent: string

  /** Comment style detected */
  commentStyle: CommentStyle
}

/**
 * Result of a single injection operation
 */
export interface InjectionResult {
  /** Target file path */
  file: string

  /** Marker name that was injected into */
  marker: string

  /** Addon that provided this injection */
  addon: string

  /** Whether injection succeeded */
  success: boolean

  /** Error message if failed */
  error?: string

  /** Number of lines added */
  linesAdded: number
}

/**
 * Injection entry stored in manifest for tracking
 */
export interface InjectionManifestEntry {
  /** Marker name */
  marker: string

  /** Addon that provided this injection */
  addon: string

  /** Hash of injected content for change detection */
  hash: string
}

/**
 * Schema for injection manifest entries
 */
export const InjectionManifestEntrySchema = z.object({
  marker: z.string(),
  addon: z.string(),
  hash: z.string(),
})

/**
 * Options for the injection processor
 */
export interface ProcessInjectionsOptions {
  /** Project output directory */
  projectDir: string

  /** Injection definitions from addon */
  injections: InjectionDefinition[]

  /** Name of the addon providing injections */
  addonName: string

  /** Template context for EJS rendering */
  context: TemplateContextLike

  /** Base path for resolving template files */
  templateBasePath?: string
}

/**
 * Minimal template context interface for injection
 * (avoids circular dependency with templates/engine.ts)
 */
export interface TemplateContextLike {
  projectName: string
  projectNamePascal: string
  projectNameCamel: string
  description: string
  author: string
  license: string
  year: number
  githubUsername: string
  githubUrl: string
  archetype: string
  apiFramework: string | undefined
  webFramework: string | undefined
  addons: string[]
  hasAddon: (name: string) => boolean
  kebabCase: (str: string) => string
  pascalCase: (str: string) => string
  camelCase: (str: string) => string
}
