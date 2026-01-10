import { describe, expect, it } from 'bun:test'
import { spawn } from 'node:child_process'

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
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
  })
}

describe('CLI', () => {
  it('should show help with --help flag', async () => {
    const { stdout, exitCode } = await runCli(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('USAGE:')
    expect(stdout).toContain('bakery')
  })

  it('should show version with --version flag', async () => {
    const { stdout, exitCode } = await runCli(['--version'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should show help with -h flag', async () => {
    const { stdout, exitCode } = await runCli(['-h'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('USAGE:')
  })

  it('should show version with -v flag', async () => {
    const { stdout, exitCode } = await runCli(['-v'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should fail with unknown option', async () => {
    const { stderr, exitCode } = await runCli(['--unknown'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Unknown option')
  })

  it('should show features in help output', async () => {
    const { stdout } = await runCli(['--help'])
    expect(stdout).toContain('TypeScript')
    expect(stdout).toContain('Bun')
    expect(stdout).toContain('Biome')
  })
})
