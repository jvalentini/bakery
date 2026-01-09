/**
 * Bakery Plugin System
 *
 * This module provides the types and utilities needed to create and use
 * Bakery plugins. Plugins can extend Bakery with:
 *
 * - Additional templates and archetypes
 * - Custom addons
 * - Lifecycle hooks for generation
 * - Custom prompts in the wizard
 *
 * @example
 * ```typescript
 * // Creating a simple plugin
 * import type { BakeryPlugin } from 'bakery/plugins';
 *
 * const myPlugin: BakeryPlugin = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   templates: ['./templates/my-addon'],
 *   hooks: {
 *     afterGenerate: async (ctx) => {
 *       ctx.logger.info('Generation complete!');
 *     },
 *   },
 * };
 *
 * export default myPlugin;
 * ```
 *
 * @module
 */

// Core plugin types
// Context types
// Hook types
export type {
  AfterGenerateResult,
  BakeryPlugin,
  BeforeGenerateResult,
  LoadedPlugin,
  PluginContext,
  PluginFileSystem,
  PluginHooks,
  PluginLogger,
  PluginManifest,
  PluginPrompt,
  PluginRegistry,
  PluginTemplateUtils,
  ProjectConfig,
} from './types.js';

// Type guards
export { isBakeryPlugin, isPluginManifest } from './types.js';
