import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { generateProject } from '../src/wizard/generator.js'
import type { ProjectConfig } from '../src/wizard/prompts.js'

describe('generator', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-test-'))
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  const defaultConfig: ProjectConfig = {
    projectName: 'test-project',
    description: 'A test project',
    author: 'Test Author',
    license: 'MIT',
    githubUsername: 'testuser',
    archetype: 'cli',
    apiFramework: undefined,
    webFramework: undefined,
    addons: ['docker', 'ci', 'release', 'docs', 'security', 'zod'],
  }

  it('should create package.json with correct name', () => {
    generateProject(defaultConfig, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    expect(pkg.name).toBe('test-project')
    expect(pkg.description).toBe('A test project')
    expect(pkg.author).toBe('Test Author')
    expect(pkg.license).toBe('MIT')
  })

  it('should create src/cli.ts', () => {
    generateProject(defaultConfig, testDir)

    const cliPath = path.join(testDir, 'src', 'cli.ts')
    expect(fs.existsSync(cliPath)).toBe(true)

    const content = fs.readFileSync(cliPath, 'utf-8')
    expect(content).toContain('test-project')
  })

  it('should create utility files', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'src', 'utils', 'colors.ts'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'src', 'utils', 'errors.ts'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'src', 'utils', 'logger.ts'))).toBe(true)
  })

  it('should create config files', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'tsconfig.json'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'biome.json'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'lefthook.yml'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, '.gitignore'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'Makefile'))).toBe(true)
  })

  it('should create test files', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'tests', 'cli.test.ts'))).toBe(true)
  })

  it('should create Docker files when docker addon is enabled', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'Dockerfile'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'docker-compose.yml'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, '.dockerignore'))).toBe(true)
  })

  it('should not create Docker files when docker addon is not enabled', () => {
    generateProject({ ...defaultConfig, addons: ['ci'] }, testDir)

    expect(fs.existsSync(path.join(testDir, 'Dockerfile'))).toBe(false)
    expect(fs.existsSync(path.join(testDir, 'docker-compose.yml'))).toBe(false)
  })

  it('should create CI workflow when ci addon is enabled', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, '.github', 'workflows', 'ci.yml'))).toBe(true)
  })

  it('should not create CI workflow when ci addon is not enabled', () => {
    generateProject({ ...defaultConfig, addons: [] }, testDir)

    expect(fs.existsSync(path.join(testDir, '.github', 'workflows', 'ci.yml'))).toBe(false)
  })

  it('should create README.md', () => {
    generateProject(defaultConfig, testDir)

    const readmePath = path.join(testDir, 'README.md')
    expect(fs.existsSync(readmePath)).toBe(true)

    const content = fs.readFileSync(readmePath, 'utf-8')
    expect(content).toContain('test-project')
    expect(content).toContain('A test project')
  })

  it('should create AGENTS.md', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'AGENTS.md'))).toBe(true)
  })

  it('should handle project names with hyphens in binary names', () => {
    generateProject(defaultConfig, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

    expect(pkg.bin['test-project']).toBe('./dist/cli.js')
    expect(pkg.scripts['build:binary']).toContain('test-project')
  })

  it('should create security files when security addon is enabled', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'trivy.yaml'))).toBe(true)
  })

  it('should create typedoc config when docs addon is enabled', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'typedoc.json'))).toBe(true)
  })
})
