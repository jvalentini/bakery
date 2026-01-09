/**
 * Tests for plugin system types
 */
import { describe, expect, it } from 'bun:test';
import {
  type AfterGenerateResult,
  type BakeryPlugin,
  type BeforeGenerateResult,
  isBakeryPlugin,
  isPluginManifest,
  type PluginContext,
  type PluginHooks,
  type PluginManifest,
} from '../src/plugins/index.js';

describe('Plugin Type Guards', () => {
  describe('isBakeryPlugin', () => {
    it('should return true for valid plugin', () => {
      const plugin: BakeryPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };
      expect(isBakeryPlugin(plugin)).toBe(true);
    });

    it('should return true for plugin with all fields', () => {
      const plugin: BakeryPlugin = {
        name: 'full-plugin',
        version: '2.0.0',
        displayName: 'Full Plugin',
        description: 'A fully configured plugin',
        templates: ['./templates/addon1'],
        prompts: [
          {
            name: 'customOption',
            type: 'select',
            message: 'Choose an option',
            options: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ],
          },
        ],
        hooks: {
          beforeGenerate: async () => {},
          afterGenerate: async () => {},
        },
      };
      expect(isBakeryPlugin(plugin)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isBakeryPlugin(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBakeryPlugin(undefined)).toBe(false);
    });

    it('should return false for object without name', () => {
      expect(isBakeryPlugin({ version: '1.0.0' })).toBe(false);
    });

    it('should return false for object without version', () => {
      expect(isBakeryPlugin({ name: 'test' })).toBe(false);
    });

    it('should return false for non-string name', () => {
      expect(isBakeryPlugin({ name: 123, version: '1.0.0' })).toBe(false);
    });

    it('should return false for non-string version', () => {
      expect(isBakeryPlugin({ name: 'test', version: 1 })).toBe(false);
    });
  });

  describe('isPluginManifest', () => {
    it('should return true for valid manifest', () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        displayName: 'Test Plugin',
        description: 'A test plugin',
        version: '1.0.0',
      };
      expect(isPluginManifest(manifest)).toBe(true);
    });

    it('should return true for manifest with all fields', () => {
      const manifest: PluginManifest = {
        name: 'full-plugin',
        displayName: 'Full Plugin',
        description: 'A fully configured plugin',
        version: '2.0.0',
        author: 'Test Author',
        homepage: 'https://example.com',
        bakeryVersion: '>=1.0.0',
        templates: ['./templates/addon1'],
        archetypes: ['./archetypes/custom'],
        addons: ['./addons/custom-addon'],
        keywords: ['bakery', 'plugin', 'test'],
        dependencies: ['other-plugin'],
      };
      expect(isPluginManifest(manifest)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPluginManifest(null)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isPluginManifest({ name: 'test' })).toBe(false);
      expect(isPluginManifest({ name: 'test', displayName: 'Test' })).toBe(false);
      expect(isPluginManifest({ name: 'test', displayName: 'Test', description: 'Desc' })).toBe(
        false
      );
    });
  });
});

describe('Plugin Types', () => {
  describe('BakeryPlugin', () => {
    it('should allow minimal plugin definition', () => {
      const plugin: BakeryPlugin = {
        name: 'minimal-plugin',
        version: '1.0.0',
      };
      expect(plugin.name).toBe('minimal-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    it('should allow plugin with hooks', () => {
      const hooks: PluginHooks = {
        beforeGenerate: async (ctx) => {
          return { skipGeneration: false };
        },
        afterGenerate: async (ctx) => {
          return {
            additionalFiles: new Map([['extra.txt', 'content']]),
          };
        },
        onError: async (error, ctx) => {
          // Handle error
        },
      };

      const plugin: BakeryPlugin = {
        name: 'hooks-plugin',
        version: '1.0.0',
        hooks,
      };

      expect(plugin.hooks).toBeDefined();
      expect(plugin.hooks?.beforeGenerate).toBeDefined();
      expect(plugin.hooks?.afterGenerate).toBeDefined();
      expect(plugin.hooks?.onError).toBeDefined();
    });

    it('should allow plugin with prompts', () => {
      const plugin: BakeryPlugin = {
        name: 'prompts-plugin',
        version: '1.0.0',
        prompts: [
          {
            name: 'databaseType',
            type: 'select',
            message: 'Select database type',
            default: 'postgresql',
            options: [
              { value: 'postgresql', label: 'PostgreSQL' },
              { value: 'mysql', label: 'MySQL' },
              { value: 'sqlite', label: 'SQLite' },
            ],
            when: (config) => config.archetype === 'api',
            validate: (value) => (value ? true : 'Database type is required'),
          },
          {
            name: 'useCache',
            type: 'confirm',
            message: 'Enable caching?',
            default: true,
          },
        ],
      };

      expect(plugin.prompts).toHaveLength(2);
      expect(plugin.prompts?.[0]?.name).toBe('databaseType');
      expect(plugin.prompts?.[1]?.type).toBe('confirm');
    });
  });

  describe('BeforeGenerateResult', () => {
    it('should allow skip generation', () => {
      const result: BeforeGenerateResult = {
        skipGeneration: true,
      };
      expect(result.skipGeneration).toBe(true);
    });

    it('should allow config overrides', () => {
      const result: BeforeGenerateResult = {
        configOverrides: {
          addons: ['extra-addon'],
          customOptions: { myOption: 'value' },
        },
      };
      expect(result.configOverrides?.addons).toContain('extra-addon');
    });
  });

  describe('AfterGenerateResult', () => {
    it('should allow additional files', () => {
      const result: AfterGenerateResult = {
        additionalFiles: new Map([
          ['README.md', '# Updated README'],
          ['.env.example', 'DB_HOST=localhost'],
        ]),
      };
      expect(result.additionalFiles?.size).toBe(2);
    });

    it('should allow commands', () => {
      const result: AfterGenerateResult = {
        commands: [
          {
            command: 'bun',
            args: ['install'],
            description: 'Installing dependencies',
          },
          {
            command: 'bun',
            args: ['run', 'setup'],
            cwd: './scripts',
            description: 'Running setup script',
          },
        ],
      };
      expect(result.commands).toHaveLength(2);
      expect(result.commands?.[0]?.command).toBe('bun');
    });

    it('should allow file removal', () => {
      const result: AfterGenerateResult = {
        removeFiles: ['unwanted.txt', 'temp/'],
      };
      expect(result.removeFiles).toContain('unwanted.txt');
    });
  });
});

describe('PluginManifest', () => {
  it('should support all optional fields', () => {
    const manifest: PluginManifest = {
      name: 'complete-plugin',
      displayName: 'Complete Plugin',
      description: 'A plugin with all fields',
      version: '1.0.0',
      author: 'Plugin Author',
      homepage: 'https://github.com/author/plugin',
      bakeryVersion: '>=1.0.0',
      templates: ['./templates/main'],
      archetypes: ['./archetypes/custom-arch'],
      addons: ['./addons/custom-addon'],
      keywords: ['bakery', 'plugin', 'complete'],
      dependencies: ['base-plugin'],
    };

    expect(manifest.name).toBe('complete-plugin');
    expect(manifest.author).toBe('Plugin Author');
    expect(manifest.templates).toHaveLength(1);
    expect(manifest.archetypes).toHaveLength(1);
    expect(manifest.addons).toHaveLength(1);
    expect(manifest.dependencies).toHaveLength(1);
  });
});
