import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  createManifest,
  detectChanges,
  getManifestPath,
  isManaged,
  loadManifest,
  type Manifest,
  saveManifest,
} from '../src/sync/manifest.js'

describe('Manifest Utilities', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-manifest-test-'))
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe('isManaged', () => {
    it('should recognize managed files', () => {
      expect(isManaged('biome.json')).toBe(true)
      expect(isManaged('tsconfig.json')).toBe(true)
      expect(isManaged('lefthook.yml')).toBe(true)
      expect(isManaged('Makefile')).toBe(true)
      expect(isManaged('.editorconfig')).toBe(true)
      expect(isManaged('knip.json')).toBe(true)
      expect(isManaged('commitlint.config.js')).toBe(true)
      expect(isManaged('.gitignore')).toBe(true)
      expect(isManaged('AGENTS.md')).toBe(true)
    })

    it('should recognize managed directories', () => {
      expect(isManaged('.github/')).toBe(true)
      expect(isManaged('.github/workflows/ci.yml')).toBe(true)
      expect(isManaged('.github/actions/setup.yml')).toBe(true)
    })

    it('should not mark unmanaged files', () => {
      expect(isManaged('src/index.ts')).toBe(false)
      expect(isManaged('package.json')).toBe(false)
      expect(isManaged('README.md')).toBe(false)
      expect(isManaged('tests/test.ts')).toBe(false)
    })

    it('should handle directory paths without trailing slash', () => {
      expect(isManaged('.github')).toBe(true)
    })
  })

  describe('getManifestPath', () => {
    it('should return correct manifest path', () => {
      const manifestPath = getManifestPath(testDir)
      expect(manifestPath).toBe(path.join(testDir, '.bakery', 'manifest.json'))
    })

    it('should handle paths with trailing slashes', () => {
      const manifestPath = getManifestPath(`${testDir}/`)
      expect(manifestPath).toContain('.bakery')
      expect(manifestPath).toContain('manifest.json')
    })
  })

  describe('loadManifest', () => {
    it('should return error when manifest does not exist', () => {
      const result = loadManifest(testDir)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('Manifest not found')
      }
    })

    it('should return error for invalid JSON', () => {
      const bakeryDir = path.join(testDir, '.bakery')
      fs.mkdirSync(bakeryDir)
      fs.writeFileSync(path.join(bakeryDir, 'manifest.json'), '{ invalid json }')

      const result = loadManifest(testDir)

      expect(result.isErr()).toBe(true)
    })

    it('should return error for invalid manifest schema', () => {
      const bakeryDir = path.join(testDir, '.bakery')
      fs.mkdirSync(bakeryDir)
      fs.writeFileSync(path.join(bakeryDir, 'manifest.json'), JSON.stringify({ invalid: 'data' }))

      const result = loadManifest(testDir)

      expect(result.isErr()).toBe(true)
    })

    it('should successfully load valid manifest', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: ['docker', 'ci'],
        generatedAt: new Date().toISOString(),
        files: {
          'package.json': {
            hash: 'abc123',
            managed: false,
            injections: [],
          },
          'biome.json': {
            hash: 'def456',
            managed: true,
            injections: [],
          },
        },
      }

      const bakeryDir = path.join(testDir, '.bakery')
      fs.mkdirSync(bakeryDir)
      fs.writeFileSync(path.join(bakeryDir, 'manifest.json'), JSON.stringify(manifest))

      const result = loadManifest(testDir)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.bakeryVersion).toBe('0.4.0')
        expect(result.value.archetype).toBe('cli')
        expect(result.value.addons).toEqual(['docker', 'ci'])
        expect(Object.keys(result.value.files)).toHaveLength(2)
      }
    })
  })

  describe('saveManifest', () => {
    it('should create .bakery directory if it does not exist', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {},
      }

      const result = saveManifest(testDir, manifest)

      expect(result.isOk()).toBe(true)
      expect(fs.existsSync(path.join(testDir, '.bakery'))).toBe(true)
    })

    it('should write manifest.json with correct content', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: ['docker'],
        generatedAt: '2024-01-01T00:00:00.000Z',
        files: {
          'test.txt': {
            hash: 'abc123',
            managed: false,
            injections: [],
          },
        },
      }

      const result = saveManifest(testDir, manifest)
      expect(result.isOk()).toBe(true)

      const manifestPath = getManifestPath(testDir)
      expect(fs.existsSync(manifestPath)).toBe(true)

      const content = fs.readFileSync(manifestPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.bakeryVersion).toBe('0.4.0')
      expect(parsed.archetype).toBe('cli')
      expect(parsed.files['test.txt'].hash).toBe('abc123')
    })

    it('should format JSON with 2-space indentation', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {},
      }

      saveManifest(testDir, manifest)

      const manifestPath = getManifestPath(testDir)
      const content = fs.readFileSync(manifestPath, 'utf-8')
      expect(content).toContain('  "bakeryVersion"')
    })

    it('should add trailing newline', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {},
      }

      saveManifest(testDir, manifest)

      const manifestPath = getManifestPath(testDir)
      const content = fs.readFileSync(manifestPath, 'utf-8')
      expect(content.endsWith('\n')).toBe(true)
    })
  })

  describe('createManifest', () => {
    it('should create manifest for project with files', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), '{}')
      fs.writeFileSync(path.join(testDir, 'biome.json'), '{}')
      fs.mkdirSync(path.join(testDir, 'src'))
      fs.writeFileSync(path.join(testDir, 'src', 'index.ts'), '')

      const result = createManifest(testDir, {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: ['docker'],
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const manifest = result.value
        expect(manifest.bakeryVersion).toBe('0.4.0')
        expect(manifest.archetype).toBe('cli')
        expect(manifest.addons).toEqual(['docker'])
        expect(manifest.files['package.json']).toBeDefined()
        expect(manifest.files['biome.json']).toBeDefined()
        expect(manifest.files['src/index.ts']).toBeDefined()
        expect(manifest.files['biome.json'].managed).toBe(true)
        expect(manifest.files['package.json'].managed).toBe(false)
      }
    })

    it('should exclude .git directory', () => {
      fs.mkdirSync(path.join(testDir, '.git'))
      fs.writeFileSync(path.join(testDir, '.git', 'config'), '')

      const result = createManifest(testDir, {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.files['.git/config']).toBeUndefined()
      }
    })

    it('should exclude node_modules directory', () => {
      fs.mkdirSync(path.join(testDir, 'node_modules'))
      fs.writeFileSync(path.join(testDir, 'node_modules', 'package.json'), '')

      const result = createManifest(testDir, {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.files['node_modules/package.json']).toBeUndefined()
      }
    })

    it('should exclude .bakery directory', () => {
      fs.mkdirSync(path.join(testDir, '.bakery'))
      fs.writeFileSync(path.join(testDir, '.bakery', 'manifest.json'), '')

      const result = createManifest(testDir, {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.files['.bakery/manifest.json']).toBeUndefined()
      }
    })

    it('should compute file hashes', () => {
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'hello world')

      const result = createManifest(testDir, {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.files['test.txt'].hash).toBe(
          'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
        )
      }
    })

    it('should set generatedAt timestamp', () => {
      const before = Date.now()

      const result = createManifest(testDir, {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
      })

      const after = Date.now()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const timestamp = new Date(result.value.generatedAt).getTime()
        expect(timestamp).toBeGreaterThanOrEqual(before)
        expect(timestamp).toBeLessThanOrEqual(after)
      }
    })
  })

  describe('detectChanges', () => {
    it('should detect added files', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {},
      }

      fs.writeFileSync(path.join(testDir, 'new-file.txt'), 'content')

      const result = detectChanges(testDir, manifest)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const changes = result.value
        const addedFile = changes.find((c) => c.path === 'new-file.txt')
        expect(addedFile).toBeDefined()
        expect(addedFile?.type).toBe('added')
        expect(addedFile?.newHash).toBeDefined()
      }
    })

    it('should detect removed files', () => {
      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {
          'removed-file.txt': {
            hash: 'abc123',
            managed: false,
            injections: [],
          },
        },
      }

      const result = detectChanges(testDir, manifest)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const changes = result.value
        const removedFile = changes.find((c) => c.path === 'removed-file.txt')
        expect(removedFile).toBeDefined()
        expect(removedFile?.type).toBe('removed')
        expect(removedFile?.oldHash).toBe('abc123')
      }
    })

    it('should detect modified files', () => {
      fs.writeFileSync(path.join(testDir, 'modified.txt'), 'new content')

      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {
          'modified.txt': {
            hash: 'old-hash',
            managed: false,
            injections: [],
          },
        },
      }

      const result = detectChanges(testDir, manifest)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const changes = result.value
        const modifiedFile = changes.find((c) => c.path === 'modified.txt')
        expect(modifiedFile).toBeDefined()
        expect(modifiedFile?.type).toBe('modified')
        expect(modifiedFile?.oldHash).toBe('old-hash')
        expect(modifiedFile?.newHash).not.toBe('old-hash')
      }
    })

    it('should detect unchanged files', () => {
      fs.writeFileSync(path.join(testDir, 'unchanged.txt'), 'content')
      const hash = 'ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73'

      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {
          'unchanged.txt': {
            hash,
            managed: false,
            injections: [],
          },
        },
      }

      const result = detectChanges(testDir, manifest)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const changes = result.value
        const unchangedFile = changes.find((c) => c.path === 'unchanged.txt')
        expect(unchangedFile).toBeDefined()
        expect(unchangedFile?.type).toBe('unchanged')
        expect(unchangedFile?.oldHash).toBe(hash)
        expect(unchangedFile?.newHash).toBe(hash)
      }
    })

    it('should preserve managed flag in changes', () => {
      fs.writeFileSync(path.join(testDir, 'biome.json'), '{}')

      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {
          'biome.json': {
            hash: 'old-hash',
            managed: true,
            injections: [],
          },
        },
      }

      const result = detectChanges(testDir, manifest)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const changes = result.value
        const file = changes.find((c) => c.path === 'biome.json')
        expect(file?.managed).toBe(true)
      }
    })

    it('should handle complex directory structure', () => {
      fs.mkdirSync(path.join(testDir, 'src', 'utils'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'src', 'index.ts'), '')
      fs.writeFileSync(path.join(testDir, 'src', 'utils', 'helper.ts'), '')

      const manifest: Manifest = {
        bakeryVersion: '0.4.0',
        archetype: 'cli',
        addons: [],
        generatedAt: new Date().toISOString(),
        files: {},
      }

      const result = detectChanges(testDir, manifest)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const changes = result.value
        expect(changes.some((c) => c.path === 'src/index.ts')).toBe(true)
        expect(changes.some((c) => c.path === 'src/utils/helper.ts')).toBe(true)
      }
    })
  })
})
