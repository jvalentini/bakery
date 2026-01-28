import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { spawn, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

function stripAnsi(input: string): string {
  const ansiEscape = String.fromCharCode(27)
  const ansiPattern = new RegExp(`${ansiEscape}\\[[0-9;]*m`, 'g')
  return input.replace(ansiPattern, '')
}

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'src/cli.ts', ...args], {
      cwd: process.cwd(),
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
        exitCode: code ?? 0,
      })
    })
  })
}

function runCliSync(
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', ['run', path.join(process.cwd(), 'src/cli.ts'), ...args], {
    cwd: cwd ?? process.cwd(),
    encoding: 'utf-8',
    timeout: 30000,
  })
  return {
    stdout: stripAnsi(result.stdout ?? ''),
    stderr: stripAnsi(result.stderr ?? ''),
    exitCode: result.status ?? 0,
  }
}

describe('CLI plugins command', () => {
  describe('plugins help', () => {
    it('should show plugins help with --help flag', async () => {
      const { stdout, exitCode } = await runCli(['plugins', '--help'])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('bakery plugins')
      expect(stdout).toContain('COMMANDS:')
      expect(stdout).toContain('list')
      expect(stdout).toContain('add')
      expect(stdout).toContain('remove')
      expect(stdout).toContain('create')
    })

    it('should show plugins help with help subcommand', async () => {
      const { stdout, exitCode } = await runCli(['plugins', 'help'])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('bakery plugins')
    })
  })

  describe('plugins list', () => {
    it('should list plugins when none are installed', async () => {
      const { stdout, exitCode } = await runCli(['plugins', 'list'])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('No plugins installed')
    })

    it('should list plugins with ls alias', async () => {
      const { stdout, exitCode } = await runCli(['plugins', 'ls'])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('No plugins installed')
    })

    it('should list plugins with no subcommand (default)', async () => {
      const { stdout, exitCode } = await runCli(['plugins'])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('No plugins installed')
    })
  })

  describe('plugins add', () => {
    it('should fail when no package name is provided', async () => {
      const { stderr, exitCode } = await runCli(['plugins', 'add'])
      expect(exitCode).toBe(1)
      expect(stderr).toContain('Missing package name')
    })
  })

  describe('plugins remove', () => {
    it('should fail when no plugin name is provided', async () => {
      const { stderr, exitCode } = await runCli(['plugins', 'remove'])
      expect(exitCode).toBe(1)
      expect(stderr).toContain('Missing plugin name')
    })

    it('should fail when plugin is not found', async () => {
      const { stderr, exitCode } = await runCli(['plugins', 'remove', 'nonexistent-plugin'])
      expect(exitCode).toBe(1)
      expect(stderr).toContain('Plugin not found')
    })
  })

  describe('plugins unknown subcommand', () => {
    it('should fail with unknown subcommand', async () => {
      const { stderr, exitCode } = await runCli(['plugins', 'unknown-cmd'])
      expect(exitCode).toBe(1)
      expect(stderr).toContain('Unknown subcommand')
    })
  })
})

describe('plugins create command', () => {
  const tmpDir = path.join(os.tmpdir(), `bakery-create-test-${Date.now()}`)

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should scaffold a new plugin with default name', () => {
    const { stdout, exitCode } = runCliSync(['plugins', 'create'], tmpDir)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Creating plugin')
    expect(stdout).toContain('Plugin scaffolded successfully')

    // Verify files were created
    const pluginDir = path.join(tmpDir, 'bakery-plugin-my-plugin')
    expect(fs.existsSync(pluginDir)).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, 'plugin.json'))).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, 'README.md'))).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, 'templates', 'addon'))).toBe(true)
  })

  it('should scaffold a new plugin with custom name', () => {
    const { stdout, exitCode } = runCliSync(['plugins', 'create', 'custom-test'], tmpDir)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Creating plugin custom-test')
    expect(stdout).toContain('Plugin scaffolded successfully')

    // Verify plugin.json has correct name
    const pluginDir = path.join(tmpDir, 'bakery-plugin-custom-test')
    expect(fs.existsSync(pluginDir)).toBe(true)

    const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'))
    expect(manifest.name).toBe('bakery-plugin-custom-test')
    expect(manifest.displayName).toContain('Custom Test')
  })

  it('should fail if plugin directory already exists', () => {
    // Create a plugin first
    fs.mkdirSync(path.join(tmpDir, 'bakery-plugin-existing'), { recursive: true })

    const { stderr, exitCode } = runCliSync(['plugins', 'create', 'existing'], tmpDir)
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Directory already exists')
  })
})

describe('plugins command with local plugins', () => {
  const tmpDir = path.join(os.tmpdir(), `bakery-local-test-${Date.now()}`)
  const bakeryPluginsDir = path.join(tmpDir, 'bakery-plugins')
  const testPluginDir = path.join(bakeryPluginsDir, 'test-local-plugin')

  beforeAll(() => {
    fs.mkdirSync(testPluginDir, { recursive: true })

    // Create a test plugin
    const manifest = {
      name: 'test-local-plugin',
      displayName: 'Test Local Plugin',
      description: 'A test plugin for unit tests',
      version: '1.0.0',
      templates: [],
      archetypes: [],
      addons: [],
    }
    fs.writeFileSync(path.join(testPluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2))
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should list local plugins', () => {
    const { stdout, exitCode } = runCliSync(['plugins', 'list'], tmpDir)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Test Local Plugin')
    expect(stdout).toContain('v1.0.0')
    expect(stdout).toContain('[local]')
  })

  it('should find plugin by name when removing', () => {
    // Create another test plugin to remove
    const removePluginDir = path.join(bakeryPluginsDir, 'remove-test')
    fs.mkdirSync(removePluginDir, { recursive: true })
    const manifest = {
      name: 'remove-test',
      displayName: 'Remove Test Plugin',
      description: 'A plugin to test removal',
      version: '1.0.0',
    }
    fs.writeFileSync(path.join(removePluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2))

    // Try to remove - should warn about local plugins
    const { stdout, exitCode } = runCliSync(['plugins', 'remove', 'remove-test'], tmpDir)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('local plugin')
    expect(stdout).toContain('Remove it manually')
  })
})
