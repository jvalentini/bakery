import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { formatConfigError, loadConfigFile } from '../src/config/loader.js'

describe('Config Loader', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-config-test-'))
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe('loadConfigFile', () => {
    it('should return error when file does not exist', () => {
      const configPath = path.join(testDir, 'nonexistent.json')
      const result = loadConfigFile(configPath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.type).toBe('file_not_found')
        expect(result.error.message).toContain('Config file not found')
      }
    })

    // Skip in Docker/root environments where chmod doesn't prevent root from reading
    it.skipIf(process.getuid?.() === 0)('should return error when file is not readable', () => {
      const configPath = path.join(testDir, 'unreadable.json')
      fs.writeFileSync(configPath, '{}')
      fs.chmodSync(configPath, 0o000)

      const result = loadConfigFile(configPath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.type).toBe('file_not_found')
        expect(result.error.message).toContain('Failed to read config file')
      }

      fs.chmodSync(configPath, 0o644)
    })

    it('should return error when JSON is malformed', () => {
      const configPath = path.join(testDir, 'invalid.json')
      fs.writeFileSync(configPath, '{ invalid json }')

      const result = loadConfigFile(configPath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.type).toBe('parse_error')
        expect(result.error.message).toContain('Invalid JSON in config file')
      }
    })

    it('should return error when JSON fails schema validation', () => {
      const configPath = path.join(testDir, 'invalid-schema.json')
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          projectName: 'test',
        }),
      )

      const result = loadConfigFile(configPath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
        expect(result.error.message).toBe('Config file validation failed')
        expect(result.error.details).toBeDefined()
        expect(result.error.details?.length).toBeGreaterThan(0)
      }
    })

    it('should successfully load valid config', () => {
      const configPath = path.join(testDir, 'valid.json')
      const validConfig = {
        projectName: 'test-project',
        description: 'Test description',
        author: 'Test Author',
        license: 'MIT',
        githubUsername: 'testuser',
        archetype: 'cli',
        addons: ['docker', 'ci'],
      }
      fs.writeFileSync(configPath, JSON.stringify(validConfig))

      const result = loadConfigFile(configPath)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.projectName).toBe('test-project')
        expect(result.value.archetype).toBe('cli')
        expect(result.value.addons).toEqual(['docker', 'ci'])
      }
    })

    it('should resolve relative paths', () => {
      const configPath = path.join(testDir, 'config.json')
      const validConfig = {
        projectName: 'test-project',
        description: 'Test description',
        author: 'Test Author',
        license: 'MIT',
        githubUsername: 'testuser',
        archetype: 'cli',
        addons: [],
      }
      fs.writeFileSync(configPath, JSON.stringify(validConfig))

      const oldCwd = process.cwd()
      process.chdir(testDir)
      const result = loadConfigFile('config.json')
      process.chdir(oldCwd)

      expect(result.isOk()).toBe(true)
    })

    it('should validate archetype field', () => {
      const configPath = path.join(testDir, 'invalid-archetype.json')
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          projectName: 'test-project',
          description: 'Test description',
          author: 'Test Author',
          license: 'MIT',
          githubUsername: 'testuser',
          archetype: 'invalid-archetype',
          addons: [],
        }),
      )

      const result = loadConfigFile(configPath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })

    it('should validate addons are valid', () => {
      const configPath = path.join(testDir, 'invalid-addons.json')
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          projectName: 'test-project',
          description: 'Test description',
          author: 'Test Author',
          license: 'MIT',
          githubUsername: 'testuser',
          archetype: 'cli',
          addons: ['invalid-addon'],
        }),
      )

      const result = loadConfigFile(configPath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })
  })

  describe('formatConfigError', () => {
    it('should format error without details', () => {
      const error = {
        type: 'file_not_found' as const,
        message: 'File not found',
      }

      const formatted = formatConfigError(error)
      expect(formatted).toBe('File not found')
    })

    it('should format error with details', () => {
      const error = {
        type: 'validation_error' as const,
        message: 'Validation failed',
        details: ['  projectName: Required', '  archetype: Invalid enum value'],
      }

      const formatted = formatConfigError(error)
      expect(formatted).toContain('Validation failed')
      expect(formatted).toContain('projectName: Required')
      expect(formatted).toContain('archetype: Invalid enum value')
    })

    it('should format error with empty details array', () => {
      const error = {
        type: 'parse_error' as const,
        message: 'Parse error',
        details: [],
      }

      const formatted = formatConfigError(error)
      expect(formatted).toBe('Parse error')
    })
  })
})
