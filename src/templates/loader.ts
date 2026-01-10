import * as fs from 'node:fs'
import * as path from 'node:path'
import { z } from 'zod'

/**
 * Schema for post-processing configuration
 */
const PostProcessSchema = z.object({
  remove: z.array(z.string()).default([]),
  removeDeps: z.array(z.string()).default([]),
  addDeps: z.record(z.string(), z.string()).default({}),
  addDevDeps: z.record(z.string(), z.string()).default({}),
  updateScripts: z.record(z.string(), z.string()).default({}),
})

/**
 * Schema for archetype manifest (template.json)
 */
export const ArchetypeManifestSchema = z.object({
  name: z.string().describe('Unique identifier for the archetype'),
  displayName: z.string().describe('Human-readable name'),
  description: z.string().describe('Brief description of the archetype'),
  version: z.string().default('1.0.0'),

  // Dependencies on other templates
  dependencies: z
    .array(z.string())
    .default([])
    .describe('Other templates to include (e.g., "core", "addons/docker")'),

  // Additional prompts specific to this archetype
  prompts: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['text', 'select', 'multiselect', 'confirm']),
        message: z.string(),
        default: z.unknown().optional(),
        options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      }),
    )
    .default([]),

  // Files to include from this template
  files: z
    .array(z.string())
    .optional()
    .describe('Glob patterns for files to include. If omitted, all files are included.'),

  // Files to exclude
  exclude: z.array(z.string()).default([]).describe('Glob patterns for files to exclude'),

  // External base command (for templates that wrap external generators)
  baseCommand: z
    .object({
      command: z
        .string()
        .describe('Command to run (supports {{projectName}}, {{parentDir}} placeholders)'),
      workdir: z.string().default('{{parentDir}}').describe('Working directory for the command'),
    })
    .optional()
    .describe('External command to generate base project (e.g., create-convex)'),

  // Post-processing for baseCommand templates
  postProcess: PostProcessSchema.optional().describe('Post-processing steps after base generation'),

  // Hooks
  hooks: z
    .object({
      beforeGenerate: z.string().optional(),
      afterGenerate: z.string().optional(),
    })
    .default({}),
})

export type ArchetypeManifest = z.infer<typeof ArchetypeManifestSchema>

/**
 * Loaded template with its manifest and path
 */
export interface LoadedTemplate {
  manifest: ArchetypeManifest
  path: string
  isPlugin: boolean
}

/**
 * Get the templates directory (relative to this module)
 */
export function getTemplatesDir(): string {
  // In development, templates are at project root
  // In production (built), they would be bundled or at a known location
  const devPath = path.resolve(import.meta.dirname, '../../templates')
  if (fs.existsSync(devPath)) {
    return devPath
  }

  // Fallback for production builds
  const prodPath = path.resolve(import.meta.dirname, '../templates')
  if (fs.existsSync(prodPath)) {
    return prodPath
  }

  throw new Error('Templates directory not found')
}

/**
 * Load a template manifest from a directory
 */
export function loadTemplateManifest(templateDir: string): ArchetypeManifest | null {
  const manifestPath = path.join(templateDir, 'template.json')

  if (!fs.existsSync(manifestPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8')
    const json = JSON.parse(content)
    return ArchetypeManifestSchema.parse(json)
  } catch (error) {
    console.error(`Failed to load manifest from ${manifestPath}:`, error)
    return null
  }
}

/**
 * Discover all available archetypes
 */
export function discoverArchetypes(): LoadedTemplate[] {
  const templatesDir = getTemplatesDir()
  const archetypes: LoadedTemplate[] = []

  const archetypeDirs = ['cli', 'library', 'api', 'full-stack', 'convex-full-stack']
  for (const dir of archetypeDirs) {
    const dirPath = path.join(templatesDir, dir)
    if (fs.existsSync(dirPath)) {
      const manifest = loadTemplateManifest(dirPath)
      if (manifest) {
        archetypes.push({ manifest, path: dirPath, isPlugin: false })
      }
    }
  }

  return archetypes
}

/**
 * Discover all available addons
 */
export function discoverAddons(): LoadedTemplate[] {
  const templatesDir = getTemplatesDir()
  const addonsDir = path.join(templatesDir, 'addons')
  const addons: LoadedTemplate[] = []

  if (!fs.existsSync(addonsDir)) {
    return addons
  }

  const entries = fs.readdirSync(addonsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const addonPath = path.join(addonsDir, entry.name)
      const manifest = loadTemplateManifest(addonPath)
      if (manifest) {
        addons.push({ manifest, path: addonPath, isPlugin: false })
      }
    }
  }

  return addons
}

/**
 * Load core template (shared across all archetypes)
 */
export function loadCoreTemplate(): LoadedTemplate | null {
  const templatesDir = getTemplatesDir()
  const corePath = path.join(templatesDir, 'core')

  if (!fs.existsSync(corePath)) {
    return null
  }

  const manifest = loadTemplateManifest(corePath)
  if (!manifest) {
    // Create a default manifest for core if none exists
    return {
      manifest: {
        name: 'core',
        displayName: 'Core',
        description: 'Shared tooling and configuration',
        version: '1.0.0',
        dependencies: [],
        prompts: [],
        exclude: [],
        hooks: {},
      },
      path: corePath,
      isPlugin: false,
    }
  }

  return { manifest, path: corePath, isPlugin: false }
}

/**
 * Resolve all templates needed for a given archetype and addons
 */
export function resolveTemplates(
  archetypeName: string,
  selectedAddons: string[],
): LoadedTemplate[] {
  const templates: LoadedTemplate[] = []
  const templatesDir = getTemplatesDir()
  const seen = new Set<string>()

  const core = loadCoreTemplate()
  if (core) {
    templates.push(core)
    seen.add('core')
  }

  const archetypes = discoverArchetypes()
  const archetype = archetypes.find((a) => a.manifest.name === archetypeName)
  if (archetype) {
    for (const dep of archetype.manifest.dependencies) {
      if (seen.has(dep)) continue
      const depPath = path.join(templatesDir, dep)
      if (fs.existsSync(depPath)) {
        const depManifest = loadTemplateManifest(depPath)
        if (depManifest) {
          templates.push({ manifest: depManifest, path: depPath, isPlugin: false })
          seen.add(dep)
        }
      }
    }
    templates.push(archetype)
    seen.add(archetypeName)
  }

  // Load selected addons
  const allAddons = discoverAddons()
  for (const addonName of selectedAddons ?? []) {
    const addon = allAddons.find((a) => a.manifest.name === addonName)
    if (addon) {
      templates.push(addon)
    }
  }

  return templates
}
