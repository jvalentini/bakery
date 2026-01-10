/**
 * Plugin system types for Bakery
 *
 * This module defines the interfaces and types needed to create Bakery plugins.
 * Plugins can provide additional templates, archetypes, addons, and lifecycle hooks.
 *
 * @example
 * ```typescript
 * import type { BakeryPlugin, PluginContext } from 'bakery/plugins';
 *
 * const myPlugin: BakeryPlugin = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   templates: ['./templates/my-addon'],
 *   hooks: {
 *     beforeGenerate: async (ctx) => {
 *       console.log(`Generating ${ctx.config.projectName}...`);
 *     },
 *   },
 * };
 *
 * export default myPlugin;
 * ```
 *
 * @module
 */

import type { TemplateContext } from '../templates/engine.js'
import type { LoadedTemplate } from '../templates/loader.js'

// =============================================================================
// Plugin Manifest
// =============================================================================

/**
 * Manifest file (plugin.json) that describes a Bakery plugin
 *
 * This is loaded from a plugin's root directory and describes
 * what templates, archetypes, and addons the plugin provides.
 */
export interface PluginManifest {
  /** Unique identifier for the plugin (e.g., "bakery-plugin-tailwind") */
  name: string

  /** Human-readable name shown in UI (e.g., "Tailwind CSS Plugin") */
  displayName: string

  /** Brief description of what the plugin provides */
  description: string

  /** Semantic version (e.g., "1.0.0") */
  version: string

  /** Plugin author name or organization */
  author?: string

  /** URL to plugin repository or homepage */
  homepage?: string

  /** Minimum Bakery version required (e.g., ">=1.0.0") */
  bakeryVersion?: string

  /**
   * Paths to template directories provided by this plugin
   * Relative to the plugin root directory
   */
  templates?: string[]

  /**
   * Archetype definitions provided by this plugin
   * Each entry is a path to a directory with a template.json
   */
  archetypes?: string[]

  /**
   * Addon definitions provided by this plugin
   * Each entry is a path to a directory with a template.json
   */
  addons?: string[]

  /**
   * Keywords for plugin discovery/search
   */
  keywords?: string[]

  /**
   * Plugin dependencies (other plugins that must be loaded first)
   */
  dependencies?: string[]
}

// =============================================================================
// Plugin Context
// =============================================================================

/**
 * Project configuration passed to plugins
 */
export interface ProjectConfig {
  /** Project name in kebab-case */
  projectName: string

  /** Project description */
  description: string

  /** Author name */
  author: string

  /** License identifier */
  license: string

  /** GitHub username */
  githubUsername: string

  /** Selected archetype */
  archetype: string

  /** Selected API framework (if applicable) */
  apiFramework?: string

  /** Selected web framework (if applicable) */
  webFramework?: string

  /** Selected addons */
  addons: string[]

  /** Custom options from plugin prompts */
  customOptions?: Record<string, unknown>
}

/**
 * Logger interface for plugins
 */
export interface PluginLogger {
  /** Log an info message */
  info(message: string): void

  /** Log a warning message */
  warn(message: string): void

  /** Log an error message */
  error(message: string): void

  /** Log a debug message (only shown in verbose mode) */
  debug(message: string): void
}

/**
 * File system utilities available to plugins
 */
export interface PluginFileSystem {
  /** Check if a file or directory exists */
  exists(filePath: string): boolean

  /** Read a file as UTF-8 string */
  readFile(filePath: string): string

  /** Write content to a file (creates directories as needed) */
  writeFile(filePath: string, content: string): void

  /** Copy a file or directory */
  copy(src: string, dest: string): void

  /** List files in a directory */
  readDir(dirPath: string): string[]

  /** Create a directory (recursive) */
  mkdir(dirPath: string): void
}

/**
 * Template utilities available to plugins
 */
export interface PluginTemplateUtils {
  /** Render an EJS template string with the current context */
  render(template: string, additionalData?: Record<string, unknown>): string

  /** Render an EJS template file with the current context */
  renderFile(templatePath: string, additionalData?: Record<string, unknown>): string

  /** Get the current template context */
  getContext(): TemplateContext
}

/**
 * Context provided to plugin hooks during generation
 *
 * This provides plugins with access to:
 * - Project configuration
 * - File system utilities
 * - Template rendering
 * - Logging
 * - Output directory information
 */
export interface PluginContext {
  /** Project configuration from the wizard */
  config: ProjectConfig

  /** Output directory where the project is being generated */
  outputDir: string

  /** Template context for rendering */
  templateContext: TemplateContext

  /** All templates being used (in resolution order) */
  templates: LoadedTemplate[]

  /** Logger for plugin output */
  logger: PluginLogger

  /** File system utilities */
  fs: PluginFileSystem

  /** Template rendering utilities */
  template: PluginTemplateUtils

  /** Get a value from the generation state (for plugin communication) */
  getState<T>(key: string): T | undefined

  /** Set a value in the generation state (for plugin communication) */
  setState<T>(key: string, value: T): void
}

// =============================================================================
// Plugin Lifecycle Hooks
// =============================================================================

/**
 * Result returned from beforeGenerate hook
 */
export interface BeforeGenerateResult {
  /** If true, skip default generation (plugin handles everything) */
  skipGeneration?: boolean

  /** Additional templates to include in generation */
  additionalTemplates?: LoadedTemplate[]

  /** Modified project config (merged with existing) */
  configOverrides?: Partial<ProjectConfig>
}

/**
 * Result returned from afterGenerate hook
 */
export interface AfterGenerateResult {
  /** Additional files to write (path -> content) */
  additionalFiles?: Map<string, string>

  /** Files to remove from output */
  removeFiles?: string[]

  /** Post-generation commands to run */
  commands?: Array<{
    /** Command to run */
    command: string
    /** Arguments */
    args?: string[]
    /** Working directory (relative to output) */
    cwd?: string
    /** Description shown to user */
    description?: string
  }>
}

/**
 * Plugin lifecycle hooks
 *
 * Hooks are called at specific points during project generation:
 *
 * 1. `beforeGenerate` - Called before any files are generated
 *    Use this to modify config, add templates, or skip generation entirely
 *
 * 2. `afterGenerate` - Called after all files are generated
 *    Use this to add additional files, run post-processing, or execute commands
 *
 * 3. `onError` - Called if an error occurs during generation
 *    Use this for cleanup or custom error handling
 */
export interface PluginHooks {
  /**
   * Called before generation starts
   *
   * @param context - Plugin context with config and utilities
   * @returns Optional modifications to the generation process
   *
   * @example
   * ```typescript
   * beforeGenerate: async (ctx) => {
   *   // Add a custom template based on config
   *   if (ctx.config.addons.includes('tailwind')) {
   *     return {
   *       additionalTemplates: [myTailwindTemplate],
   *     };
   *   }
   * }
   * ```
   */
  beforeGenerate?(
    context: PluginContext,
  ): Promise<BeforeGenerateResult | undefined> | BeforeGenerateResult | undefined

  /**
   * Called after generation completes successfully
   *
   * @param context - Plugin context with config and utilities
   * @returns Optional additional files or commands to run
   *
   * @example
   * ```typescript
   * afterGenerate: async (ctx) => {
   *   // Run npm install after generation
   *   return {
   *     commands: [
   *       { command: 'bun', args: ['install'], description: 'Installing dependencies' },
   *     ],
   *   };
   * }
   * ```
   */
  afterGenerate?(
    context: PluginContext,
  ): Promise<AfterGenerateResult | undefined> | AfterGenerateResult | undefined

  /**
   * Called if an error occurs during generation
   *
   * @param error - The error that occurred
   * @param context - Plugin context (may be partially initialized)
   *
   * @example
   * ```typescript
   * onError: async (error, ctx) => {
   *   ctx.logger.error(`Generation failed: ${error.message}`);
   *   // Cleanup any temporary files
   * }
   * ```
   */
  onError?(error: Error, context: Partial<PluginContext>): Promise<void> | void
}

// =============================================================================
// Plugin Definition
// =============================================================================

/**
 * Custom prompt definition for plugin-specific options
 */
export interface PluginPrompt {
  /** Unique identifier for this prompt */
  name: string

  /** Prompt type */
  type: 'text' | 'select' | 'multiselect' | 'confirm'

  /** Message shown to user */
  message: string

  /** Default value */
  default?: unknown

  /** Options for select/multiselect */
  options?: Array<{ value: string; label: string }>

  /** When to show this prompt (returns true to show) */
  when?: (config: ProjectConfig) => boolean

  /** Validation function */
  validate?: (value: unknown) => string | true
}

/**
 * Main plugin interface
 *
 * A Bakery plugin is an object that provides templates, hooks, and prompts
 * to extend the project generation process.
 *
 * Plugins can be:
 * - Local (loaded from a directory)
 * - Published (installed via npm)
 *
 * @example
 * ```typescript
 * import type { BakeryPlugin } from 'bakery/plugins';
 *
 * const plugin: BakeryPlugin = {
 *   name: 'bakery-plugin-prisma',
 *   version: '1.0.0',
 *
 *   // Provide additional templates
 *   templates: ['./templates/prisma'],
 *
 *   // Add custom prompts
 *   prompts: [
 *     {
 *       name: 'prismaProvider',
 *       type: 'select',
 *       message: 'Which database provider?',
 *       options: [
 *         { value: 'postgresql', label: 'PostgreSQL' },
 *         { value: 'mysql', label: 'MySQL' },
 *         { value: 'sqlite', label: 'SQLite' },
 *       ],
 *       when: (config) => config.addons.includes('prisma'),
 *     },
 *   ],
 *
 *   // Lifecycle hooks
 *   hooks: {
 *     afterGenerate: async (ctx) => {
 *       return {
 *         commands: [
 *           { command: 'bunx', args: ['prisma', 'init'], description: 'Initializing Prisma' },
 *         ],
 *       };
 *     },
 *   },
 * };
 *
 * export default plugin;
 * ```
 */
export interface BakeryPlugin {
  /** Unique identifier for the plugin (should match package name) */
  name: string

  /** Semantic version */
  version: string

  /** Human-readable display name */
  displayName?: string

  /** Brief description */
  description?: string

  /**
   * Paths to template directories (relative to plugin root)
   * Each directory should contain a template.json manifest
   */
  templates?: string[]

  /**
   * Custom prompts to add to the wizard
   * These are shown after the default prompts
   */
  prompts?: PluginPrompt[]

  /**
   * Lifecycle hooks
   */
  hooks?: PluginHooks

  /**
   * Initialize the plugin (called once when plugin is loaded)
   *
   * @param pluginDir - Directory where the plugin is located
   * @returns Plugin manifest or void if using inline definition
   */
  init?(pluginDir: string): Promise<PluginManifest | undefined> | PluginManifest | undefined

  /**
   * Cleanup when plugin is unloaded
   */
  destroy?(): Promise<void> | void
}

// =============================================================================
// Loaded Plugin
// =============================================================================

/**
 * A plugin that has been loaded and initialized
 */
export interface LoadedPlugin {
  /** The plugin definition */
  plugin: BakeryPlugin

  /** Directory where the plugin is located */
  pluginDir: string

  /** Resolved manifest (from plugin.json or init()) */
  manifest: PluginManifest

  /** Templates provided by this plugin */
  templates: LoadedTemplate[]

  /** Whether the plugin is currently active */
  active: boolean
}

// =============================================================================
// Plugin Registry
// =============================================================================

/**
 * Plugin discovery and management
 */
export interface PluginRegistry {
  /** Discover plugins in standard locations */
  discover(): Promise<LoadedPlugin[]>

  /** Load a plugin from a directory */
  load(pluginDir: string): Promise<LoadedPlugin>

  /** Load a plugin from an npm package */
  loadPackage(packageName: string): Promise<LoadedPlugin>

  /** Get all loaded plugins */
  getPlugins(): LoadedPlugin[]

  /** Get a plugin by name */
  getPlugin(name: string): LoadedPlugin | undefined

  /** Unload a plugin */
  unload(name: string): Promise<void>
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an object is a valid BakeryPlugin
 */
export function isBakeryPlugin(obj: unknown): obj is BakeryPlugin {
  if (typeof obj !== 'object' || obj === null) return false
  const plugin = obj as Record<string, unknown>
  return typeof plugin['name'] === 'string' && typeof plugin['version'] === 'string'
}

/**
 * Check if an object is a valid PluginManifest
 */
export function isPluginManifest(obj: unknown): obj is PluginManifest {
  if (typeof obj !== 'object' || obj === null) return false
  const manifest = obj as Record<string, unknown>
  return (
    typeof manifest['name'] === 'string' &&
    typeof manifest['displayName'] === 'string' &&
    typeof manifest['description'] === 'string' &&
    typeof manifest['version'] === 'string'
  )
}
