/**
 * Plugin loader for Bakery
 *
 * Discovers, loads, and validates Bakery plugins from:
 * - Local project directory (./bakery-plugins/)
 * - User plugins directory (~/.bakery/plugins/)
 * - npm packages (bakery-plugin-*)
 *
 * @module
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { type LoadedTemplate, loadTemplateManifest } from '../templates/loader.js';
import type { BakeryPlugin, LoadedPlugin, PluginManifest } from './types.js';
import { isBakeryPlugin } from './types.js';

// =============================================================================
// Plugin Manifest Schema
// =============================================================================

/**
 * Zod schema for validating plugin.json manifests
 */
export const PluginManifestSchema = z.object({
  name: z.string().min(1).describe('Unique identifier for the plugin'),
  displayName: z.string().min(1).describe('Human-readable name'),
  description: z.string().describe('Brief description of the plugin'),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Must be semver format'),

  author: z.string().optional(),
  homepage: z.string().url().optional(),
  bakeryVersion: z.string().optional(),

  templates: z.array(z.string()).default([]),
  archetypes: z.array(z.string()).default([]),
  addons: z.array(z.string()).default([]),

  keywords: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
});

// =============================================================================
// Plugin Locations
// =============================================================================

/**
 * Get the user's plugins directory (~/.bakery/plugins/)
 */
export function getUserPluginsDir(): string {
  return path.join(os.homedir(), '.bakery', 'plugins');
}

/**
 * Get the local project plugins directory (./bakery-plugins/)
 */
export function getLocalPluginsDir(): string {
  return path.resolve(process.cwd(), 'bakery-plugins');
}

/**
 * Get all plugin search paths in priority order
 * Local plugins take precedence over user plugins
 */
export function getPluginSearchPaths(): string[] {
  return [getLocalPluginsDir(), getUserPluginsDir()];
}

// =============================================================================
// Plugin Discovery
// =============================================================================

/**
 * Discover plugins in a directory
 * Each subdirectory with a plugin.json is considered a plugin
 */
export function discoverPluginsInDir(dir: string): string[] {
  const plugins: string[] = [];

  if (!fs.existsSync(dir)) {
    return plugins;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginDir = path.join(dir, entry.name);
        const manifestPath = path.join(pluginDir, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
          plugins.push(pluginDir);
        }
      }
    }
  } catch {
    // Directory not readable, skip
  }

  return plugins;
}

/**
 * Discover all plugins in standard locations
 */
export function discoverPlugins(): string[] {
  const plugins: string[] = [];
  const seen = new Set<string>();

  for (const searchPath of getPluginSearchPaths()) {
    for (const pluginDir of discoverPluginsInDir(searchPath)) {
      const pluginName = path.basename(pluginDir);
      // Local plugins override user plugins with the same name
      if (!seen.has(pluginName)) {
        seen.add(pluginName);
        plugins.push(pluginDir);
      }
    }
  }

  return plugins;
}

/**
 * Find an npm package that is a Bakery plugin
 * Looks for packages matching bakery-plugin-* or @scope/bakery-plugin-*
 */
export function findNpmPlugin(packageName: string): string | null {
  // Try to resolve from node_modules
  const searchPaths = [
    path.join(process.cwd(), 'node_modules', packageName),
    path.join(process.cwd(), 'node_modules', '@bakery', packageName),
  ];

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      // Check if it has a plugin.json or exports a plugin
      const manifestPath = path.join(searchPath, 'plugin.json');
      const packageJsonPath = path.join(searchPath, 'package.json');

      if (fs.existsSync(manifestPath) || fs.existsSync(packageJsonPath)) {
        return searchPath;
      }
    }
  }

  return null;
}

/**
 * Discover npm plugins in node_modules
 * Looks for packages starting with bakery-plugin-
 */
export function discoverNpmPlugins(): string[] {
  const plugins: string[] = [];
  const nodeModulesDir = path.join(process.cwd(), 'node_modules');

  if (!fs.existsSync(nodeModulesDir)) {
    return plugins;
  }

  try {
    const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('bakery-plugin-')) {
          const pluginDir = path.join(nodeModulesDir, entry.name);
          if (
            fs.existsSync(path.join(pluginDir, 'plugin.json')) ||
            fs.existsSync(path.join(pluginDir, 'package.json'))
          ) {
            plugins.push(pluginDir);
          }
        }
        // Check scoped packages (@scope/bakery-plugin-*)
        else if (entry.name.startsWith('@')) {
          const scopeDir = path.join(nodeModulesDir, entry.name);
          try {
            const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
            for (const scopedEntry of scopedEntries) {
              if (scopedEntry.isDirectory() && scopedEntry.name.startsWith('bakery-plugin-')) {
                const pluginDir = path.join(scopeDir, scopedEntry.name);
                if (
                  fs.existsSync(path.join(pluginDir, 'plugin.json')) ||
                  fs.existsSync(path.join(pluginDir, 'package.json'))
                ) {
                  plugins.push(pluginDir);
                }
              }
            }
          } catch {
            // Skip unreadable scope directories
          }
        }
      }
    }
  } catch {
    // node_modules not readable
  }

  return plugins;
}

// =============================================================================
// Plugin Loading
// =============================================================================

/**
 * Load a plugin manifest from a directory
 */
export function loadPluginManifest(pluginDir: string): PluginManifest | null {
  const manifestPath = path.join(pluginDir, 'plugin.json');

  if (!fs.existsSync(manifestPath)) {
    // Try to create manifest from package.json
    return loadManifestFromPackageJson(pluginDir);
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const json = JSON.parse(content);
    return PluginManifestSchema.parse(json) as PluginManifest;
  } catch (error) {
    console.error(`Failed to load plugin manifest from ${manifestPath}:`, error);
    return null;
  }
}

/**
 * Create a plugin manifest from package.json for npm plugins
 */
function loadManifestFromPackageJson(pluginDir: string): PluginManifest | null {
  const packageJsonPath = path.join(pluginDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      name?: string;
      version?: string;
      description?: string;
      author?: string | { name?: string };
      homepage?: string;
      bakery?: {
        templates?: string[];
        archetypes?: string[];
        addons?: string[];
      };
      keywords?: string[];
    };

    // Check if this is a bakery plugin
    if (!pkg.name?.includes('bakery-plugin')) {
      return null;
    }

    const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;

    return {
      name: pkg.name ?? 'unknown',
      displayName: pkg.name?.replace('bakery-plugin-', '').replace(/-/g, ' ') ?? 'Unknown Plugin',
      description: pkg.description ?? '',
      version: pkg.version ?? '0.0.0',
      ...(author && { author }),
      ...(pkg.homepage && { homepage: pkg.homepage }),
      templates: pkg.bakery?.templates ?? [],
      archetypes: pkg.bakery?.archetypes ?? [],
      addons: pkg.bakery?.addons ?? [],
      keywords: pkg.keywords ?? [],
      dependencies: [],
    };
  } catch {
    return null;
  }
}

/**
 * Load a plugin's JavaScript/TypeScript module
 */
async function loadPluginModule(pluginDir: string): Promise<BakeryPlugin | null> {
  // Try common entry points
  const entryPoints = [
    'index.ts',
    'index.js',
    'plugin.ts',
    'plugin.js',
    'src/index.ts',
    'src/index.js',
  ];

  for (const entryPoint of entryPoints) {
    const entryPath = path.join(pluginDir, entryPoint);
    if (fs.existsSync(entryPath)) {
      try {
        const module = (await import(entryPath)) as { default?: unknown };
        const plugin = module.default;
        if (isBakeryPlugin(plugin)) {
          return plugin;
        }
      } catch {
        // Entry point exists but failed to load
      }
    }
  }

  return null;
}

/**
 * Load templates from a plugin
 */
function loadPluginTemplates(pluginDir: string, manifest: PluginManifest): LoadedTemplate[] {
  const templates: LoadedTemplate[] = [];

  // Load templates
  for (const templatePath of manifest.templates ?? []) {
    const fullPath = path.resolve(pluginDir, templatePath);
    if (fs.existsSync(fullPath)) {
      const templateManifest = loadTemplateManifest(fullPath);
      if (templateManifest) {
        templates.push({
          manifest: templateManifest,
          path: fullPath,
          isPlugin: true,
        });
      }
    }
  }

  // Load archetypes
  for (const archetypePath of manifest.archetypes ?? []) {
    const fullPath = path.resolve(pluginDir, archetypePath);
    if (fs.existsSync(fullPath)) {
      const templateManifest = loadTemplateManifest(fullPath);
      if (templateManifest) {
        templates.push({
          manifest: templateManifest,
          path: fullPath,
          isPlugin: true,
        });
      }
    }
  }

  // Load addons
  for (const addonPath of manifest.addons ?? []) {
    const fullPath = path.resolve(pluginDir, addonPath);
    if (fs.existsSync(fullPath)) {
      const templateManifest = loadTemplateManifest(fullPath);
      if (templateManifest) {
        templates.push({
          manifest: templateManifest,
          path: fullPath,
          isPlugin: true,
        });
      }
    }
  }

  return templates;
}

/**
 * Load a plugin from a directory
 */
export async function loadPlugin(pluginDir: string): Promise<LoadedPlugin | null> {
  // Load manifest
  const manifest = loadPluginManifest(pluginDir);
  if (!manifest) {
    return null;
  }

  // Try to load plugin module (for hooks and prompts)
  const pluginModule = await loadPluginModule(pluginDir);

  // Create plugin object (use module if available, otherwise create from manifest)
  const plugin: BakeryPlugin = pluginModule ?? {
    name: manifest.name,
    version: manifest.version,
    displayName: manifest.displayName,
    description: manifest.description,
  };

  // Load templates
  const templates = loadPluginTemplates(pluginDir, manifest);

  return {
    plugin,
    pluginDir,
    manifest,
    templates,
    active: true,
  };
}

/**
 * Load a plugin from an npm package name
 */
export async function loadNpmPlugin(packageName: string): Promise<LoadedPlugin | null> {
  const pluginDir = findNpmPlugin(packageName);
  if (!pluginDir) {
    return null;
  }
  return loadPlugin(pluginDir);
}

// =============================================================================
// Plugin Registry
// =============================================================================

/**
 * Registry of loaded plugins
 */
class PluginRegistryImpl {
  private plugins: Map<string, LoadedPlugin> = new Map();

  /**
   * Discover and load all plugins
   */
  async discover(): Promise<LoadedPlugin[]> {
    const loadedPlugins: LoadedPlugin[] = [];

    // Discover plugins in standard locations
    const pluginDirs = discoverPlugins();
    for (const pluginDir of pluginDirs) {
      const plugin = await loadPlugin(pluginDir);
      if (plugin) {
        this.plugins.set(plugin.manifest.name, plugin);
        loadedPlugins.push(plugin);
      }
    }

    // Discover npm plugins
    const npmPluginDirs = discoverNpmPlugins();
    for (const pluginDir of npmPluginDirs) {
      const plugin = await loadPlugin(pluginDir);
      if (plugin && !this.plugins.has(plugin.manifest.name)) {
        this.plugins.set(plugin.manifest.name, plugin);
        loadedPlugins.push(plugin);
      }
    }

    return loadedPlugins;
  }

  /**
   * Load a plugin from a directory
   */
  async load(pluginDir: string): Promise<LoadedPlugin> {
    const plugin = await loadPlugin(pluginDir);
    if (!plugin) {
      throw new Error(`Failed to load plugin from ${pluginDir}`);
    }
    this.plugins.set(plugin.manifest.name, plugin);
    return plugin;
  }

  /**
   * Load a plugin from an npm package
   */
  async loadPackage(packageName: string): Promise<LoadedPlugin> {
    const plugin = await loadNpmPlugin(packageName);
    if (!plugin) {
      throw new Error(`Failed to load plugin package ${packageName}`);
    }
    this.plugins.set(plugin.manifest.name, plugin);
    return plugin;
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Unload a plugin
   */
  async unload(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
      // Call destroy hook if present
      if (plugin.plugin.destroy) {
        await plugin.plugin.destroy();
      }
      plugin.active = false;
      this.plugins.delete(name);
    }
  }

  /**
   * Get all templates from all loaded plugins
   */
  getAllTemplates(): LoadedTemplate[] {
    const templates: LoadedTemplate[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.active) {
        templates.push(...plugin.templates);
      }
    }
    return templates;
  }

  /**
   * Get all active hooks from all plugins
   */
  getHooks(): Array<{ pluginName: string; hooks: NonNullable<BakeryPlugin['hooks']> }> {
    const hooks: Array<{ pluginName: string; hooks: NonNullable<BakeryPlugin['hooks']> }> = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.active && plugin.plugin.hooks) {
        hooks.push({
          pluginName: plugin.manifest.name,
          hooks: plugin.plugin.hooks,
        });
      }
    }
    return hooks;
  }

  /**
   * Get all prompts from all plugins
   */
  getAllPrompts(): Array<{ pluginName: string; prompts: NonNullable<BakeryPlugin['prompts']> }> {
    const prompts: Array<{ pluginName: string; prompts: NonNullable<BakeryPlugin['prompts']> }> =
      [];
    for (const plugin of this.plugins.values()) {
      if (plugin.active && plugin.plugin.prompts) {
        prompts.push({
          pluginName: plugin.manifest.name,
          prompts: plugin.plugin.prompts,
        });
      }
    }
    return prompts;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
  }
}

/**
 * Global plugin registry instance
 */
export const pluginRegistry = new PluginRegistryImpl();

/**
 * Create a new plugin registry (for testing)
 */
export function createPluginRegistry(): PluginRegistryImpl {
  return new PluginRegistryImpl();
}
