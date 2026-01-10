import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfigFile } from '../src/config/index.js';
import { generateProject } from '../src/wizard/generator.js';

let baseTestDir: string;

beforeAll(() => {
  baseTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-archetype-test-'));
});

afterAll(() => {
  fs.rmSync(baseTestDir, { recursive: true, force: true });
});

function fileExists(dir: string, ...parts: string[]): boolean {
  return fs.existsSync(path.join(dir, ...parts));
}

function isValidJson(dir: string, ...parts: string[]): boolean {
  try {
    const content = fs.readFileSync(path.join(dir, ...parts), 'utf-8');
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function getExampleConfigs(): string[] {
  const examplesDir = path.join(import.meta.dirname, '..', 'examples');
  return fs
    .readdirSync(examplesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(examplesDir, f));
}

describe('Archetype smoke tests', () => {
  const configs = getExampleConfigs();

  for (const configPath of configs) {
    const configName = path.basename(configPath, '.json');

    describe(configName, () => {
      let projectDir: string;
      let generationError: Error | null = null;

      beforeAll(() => {
        projectDir = path.join(baseTestDir, configName);

        const configResult = loadConfigFile(configPath);
        if (configResult.isErr()) {
          generationError = new Error(`Failed to load config: ${configResult.error}`);
          return;
        }

        try {
          generateProject(configResult.value, projectDir);
        } catch (err) {
          generationError = err instanceof Error ? err : new Error(String(err));
        }
      });

      it('should generate without errors', () => {
        expect(generationError).toBeNull();
      });

      it('should create package.json', () => {
        if (generationError) return;
        expect(fileExists(projectDir, 'package.json')).toBe(true);
      });

      it('should have valid package.json', () => {
        if (generationError) return;
        if (!fileExists(projectDir, 'package.json')) return;
        expect(isValidJson(projectDir, 'package.json')).toBe(true);
      });

      it('should create tsconfig.json', () => {
        if (generationError) return;
        expect(fileExists(projectDir, 'tsconfig.json')).toBe(true);
      });

      it('should have valid tsconfig.json', () => {
        if (generationError) return;
        if (!fileExists(projectDir, 'tsconfig.json')) return;
        expect(isValidJson(projectDir, 'tsconfig.json')).toBe(true);
      });

      it('should create biome.json', () => {
        if (generationError) return;
        expect(fileExists(projectDir, 'biome.json')).toBe(true);
      });

      it('should have valid biome.json', () => {
        if (generationError) return;
        if (!fileExists(projectDir, 'biome.json')) return;
        expect(isValidJson(projectDir, 'biome.json')).toBe(true);
      });

      it('should create Makefile', () => {
        if (generationError) return;
        expect(fileExists(projectDir, 'Makefile')).toBe(true);
      });

      it('should create README.md', () => {
        if (generationError) return;
        expect(fileExists(projectDir, 'README.md')).toBe(true);
      });

      it('should have package.json with name field', () => {
        if (generationError) return;
        if (!fileExists(projectDir, 'package.json')) return;

        const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(pkg.name).toBeDefined();
        expect(typeof pkg.name).toBe('string');
      });

      it('should have package.json with scripts field', () => {
        if (generationError) return;
        if (!fileExists(projectDir, 'package.json')) return;

        const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(pkg.scripts).toBeDefined();
        expect(typeof pkg.scripts).toBe('object');
      });
    });
  }
});
