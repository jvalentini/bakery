import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { generateProject, generateProjectDryRun } from '../src/wizard/generator.js'
import type { ProjectConfig } from '../src/wizard/prompts.js'

const isGitAvailable = (() => {
  try {
    execSync('git --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

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

  it('should handle different archetypes', () => {
    const apiConfig: ProjectConfig = {
      ...defaultConfig,
      archetype: 'api',
      apiFramework: 'hono',
      addons: [],
    }

    generateProject(apiConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'package.json'))).toBe(true)
    const pkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf-8'))
    expect(pkg.dependencies?.hono).toBeDefined()
  })

  it('should handle library archetype', () => {
    const libConfig: ProjectConfig = {
      ...defaultConfig,
      archetype: 'library',
      addons: [],
    }

    generateProject(libConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'src', 'index.ts'))).toBe(true)
  })

  it('should create .bakery directory with setup files', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, '.bakery'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, '.bakery', 'setup.json'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, '.bakery', 'manifest.json'))).toBe(true)
  })

  it.skipIf(!isGitAvailable)('should create .git directory', () => {
    generateProject(defaultConfig, testDir)

    expect(fs.existsSync(path.join(testDir, '.git'))).toBe(true)
  })

  it('should handle minimal config with no addons', () => {
    const minimalConfig: ProjectConfig = {
      projectName: 'minimal-project',
      description: 'Minimal project',
      author: 'Test',
      license: 'MIT',
      githubUsername: 'test',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: [],
    }

    generateProject(minimalConfig, testDir)

    expect(fs.existsSync(path.join(testDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(testDir, 'Dockerfile'))).toBe(false)
  })
})

describe('generateProjectDryRun', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-dryrun-'))
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
    addons: ['docker', 'ci'],
  }

  it('should return list of files without creating them', () => {
    const result = generateProjectDryRun(defaultConfig, testDir)

    expect(result.files.length).toBeGreaterThan(0)
    expect(result.totalSize).toBeGreaterThan(0)
    expect(fs.existsSync(path.join(testDir, 'package.json'))).toBe(false)
  })

  it('should include file paths and sizes', () => {
    const result = generateProjectDryRun(defaultConfig, testDir)

    const pkgJson = result.files.find((f) => f.path === 'package.json')
    expect(pkgJson).toBeDefined()
    expect(pkgJson?.size).toBeGreaterThan(0)
  })

  it('should calculate total size correctly', () => {
    const result = generateProjectDryRun(defaultConfig, testDir)

    const manualTotal = result.files.reduce((sum, f) => sum + f.size, 0)
    expect(result.totalSize).toBe(manualTotal)
  })

  it('should include addon files in dry run', () => {
    const result = generateProjectDryRun(defaultConfig, testDir)

    const dockerfile = result.files.find((f) => f.path === 'Dockerfile')
    const ciWorkflow = result.files.find((f) => f.path.includes('.github/workflows'))

    expect(dockerfile).toBeDefined()
    expect(ciWorkflow).toBeDefined()
  })

  it('should exclude addon files when not selected', () => {
    const noAddonsConfig: ProjectConfig = {
      ...defaultConfig,
      addons: [],
    }

    const result = generateProjectDryRun(noAddonsConfig, testDir)

    const dockerfile = result.files.find((f) => f.path === 'Dockerfile')
    expect(dockerfile).toBeUndefined()
  })

  it('should work with different archetypes', () => {
    const apiConfig: ProjectConfig = {
      ...defaultConfig,
      archetype: 'api',
      apiFramework: 'hono',
      addons: [],
    }

    const result = generateProjectDryRun(apiConfig, testDir)

    expect(result.files.length).toBeGreaterThan(0)
    const serverFile = result.files.find((f) => f.path.includes('server'))
    expect(serverFile).toBeDefined()
  })

  it('should return empty arrays for commands and dependencies by default', () => {
    const result = generateProjectDryRun(defaultConfig, testDir)

    expect(Array.isArray(result.commands)).toBe(true)
    expect(Array.isArray(result.dependencies)).toBe(true)
    expect(Array.isArray(result.devDependencies)).toBe(true)
  })

  it('should handle full-stack archetype in dry run', () => {
    const fullStackConfig: ProjectConfig = {
      ...defaultConfig,
      archetype: 'full-stack',
      apiFramework: 'hono',
      webFramework: 'react-vite',
      addons: [],
    }

    const result = generateProjectDryRun(fullStackConfig, testDir)

    expect(result.files.length).toBeGreaterThan(0)
    expect(result.totalSize).toBeGreaterThan(0)
  })

  it('should include multiple addon files', () => {
    const multiAddonConfig: ProjectConfig = {
      ...defaultConfig,
      addons: ['docker', 'ci', 'docs', 'security'],
    }

    const result = generateProjectDryRun(multiAddonConfig, testDir)

    const hasDocker = result.files.some((f) => f.path === 'Dockerfile')
    const hasCI = result.files.some((f) => f.path.includes('.github'))
    const hasDocs = result.files.some((f) => f.path === 'typedoc.json')
    const hasSecurity = result.files.some((f) => f.path === 'trivy.yaml')

    expect(hasDocker).toBe(true)
    expect(hasCI).toBe(true)
    expect(hasDocs).toBe(true)
    expect(hasSecurity).toBe(true)
  })
})

describe('generator edge cases', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-edge-'))
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('should handle api archetype with express', () => {
    const expressConfig: ProjectConfig = {
      projectName: 'express-api',
      description: 'Express API',
      author: 'Test',
      license: 'MIT',
      githubUsername: 'test',
      archetype: 'api',
      apiFramework: 'express',
      webFramework: undefined,
      addons: [],
    }

    generateProject(expressConfig, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    expect(pkg.dependencies?.express).toBeDefined()
  })

  it('should handle api archetype with elysia', () => {
    const elysiaConfig: ProjectConfig = {
      projectName: 'elysia-api',
      description: 'Elysia API',
      author: 'Test',
      license: 'MIT',
      githubUsername: 'test',
      archetype: 'api',
      apiFramework: 'elysia',
      webFramework: undefined,
      addons: [],
    }

    generateProject(elysiaConfig, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    expect(pkg.dependencies?.elysia).toBeDefined()
  })

  it('should generate valid package.json structure', () => {
    const config: ProjectConfig = {
      projectName: 'valid-pkg',
      description: 'Test project',
      author: 'Test Author',
      license: 'MIT',
      githubUsername: 'testuser',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: [],
    }

    generateProject(config, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

    expect(pkg.name).toBe('valid-pkg')
    expect(pkg.version).toBeDefined()
    expect(pkg.description).toBe('Test project')
    expect(pkg.author).toBe('Test Author')
    expect(pkg.license).toBe('MIT')
    expect(pkg.scripts).toBeDefined()
    expect(pkg.devDependencies).toBeDefined()
  })

  it('should create valid manifest.json', () => {
    const config: ProjectConfig = {
      projectName: 'manifest-test',
      description: 'Test',
      author: 'Test',
      license: 'MIT',
      githubUsername: 'test',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: ['docker'],
    }

    generateProject(config, testDir)

    const manifestPath = path.join(testDir, '.bakery', 'manifest.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    expect(manifest.bakeryVersion).toBeDefined()
    expect(manifest.archetype).toBe('cli')
    expect(manifest.addons).toContain('docker')
    expect(manifest.generatedAt).toBeDefined()
    expect(manifest.files).toBeDefined()
  })

  it('should create valid setup.json', () => {
    const config: ProjectConfig = {
      projectName: 'setup-test',
      description: 'Test',
      author: 'Test',
      license: 'MIT',
      githubUsername: 'test',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: [],
    }

    generateProject(config, testDir)

    const setupPath = path.join(testDir, '.bakery', 'setup.json')
    expect(fs.existsSync(setupPath)).toBe(true)

    const setup = JSON.parse(fs.readFileSync(setupPath, 'utf-8'))
    expect(setup.archetype).toBe('cli')
    expect(setup.generatedAt).toBeDefined()
    expect(Array.isArray(setup.tasks)).toBe(true)
  })

  it('should handle project names with special characters', () => {
    const config: ProjectConfig = {
      projectName: 'my-awesome-project',
      description: 'Test',
      author: 'Test',
      license: 'MIT',
      githubUsername: 'test',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: [],
    }

    generateProject(config, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

    expect(pkg.name).toBe('my-awesome-project')
    expect(pkg.bin['my-awesome-project']).toBeDefined()
  })

  it('should include github repository info when username provided', () => {
    const config: ProjectConfig = {
      projectName: 'github-project',
      description: 'Test',
      author: 'Test Author',
      license: 'MIT',
      githubUsername: 'testuser',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: [],
    }

    generateProject(config, testDir)

    const pkgPath = path.join(testDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

    expect(pkg.repository?.type).toBe('git')
    expect(pkg.repository?.url).toContain('testuser')
    expect(pkg.repository?.url).toContain('github-project')
    expect(pkg.homepage).toContain('github.com')
    expect(pkg.bugs?.url).toContain('issues')
  })
})
