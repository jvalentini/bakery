import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { processInjections } from '../../src/inject/index.js'
import { createTemplateContext } from '../../src/templates/engine.js'

describe('injection integration', () => {
  let testDir: string
  let context: ReturnType<typeof createTemplateContext>

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-inject-test-'))
    context = createTemplateContext({
      projectName: 'test-project',
      description: 'A test project',
      author: 'Test Author',
      license: 'MIT',
      githubUsername: 'testuser',
      archetype: 'cli',
      apiFramework: undefined,
      webFramework: undefined,
      addons: ['auth'],
    })
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('injects content into existing file with marker', () => {
    const targetFile = path.join(testDir, 'src/routes.ts')
    fs.mkdirSync(path.dirname(targetFile), { recursive: true })
    fs.writeFileSync(
      targetFile,
      `export const routes = [
  // BAKERY:INJECT:routes
  { path: '/', handler: home },
  // BAKERY:END:routes
]`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'src/routes.ts',
          marker: 'routes',
          content: "{ path: '/auth', handler: auth },",
          position: 'start',
          newline: true,
          indent: true,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.success).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toContain("{ path: '/auth', handler: auth }")
    expect(content).toContain("{ path: '/', handler: home }")

    const authIndex = content.indexOf('/auth')
    const homeIndex = content.indexOf('home')
    expect(authIndex).toBeLessThan(homeIndex)
  })

  it('injects content at end position', () => {
    const targetFile = path.join(testDir, 'app.ts')
    fs.writeFileSync(
      targetFile,
      `// BAKERY:INJECT:middleware
app.use(cors())
// BAKERY:END:middleware`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'app.ts',
          marker: 'middleware',
          content: 'app.use(auth())',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    const corsIndex = content.indexOf('cors')
    const authIndex = content.indexOf('auth()')
    expect(corsIndex).toBeLessThan(authIndex)
  })

  it('handles multiple injections to same file', () => {
    const targetFile = path.join(testDir, 'index.ts')
    fs.writeFileSync(
      targetFile,
      `// BAKERY:INJECT:imports
// BAKERY:END:imports

// BAKERY:INJECT:exports
// BAKERY:END:exports`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'index.ts',
          marker: 'imports',
          content: "import { auth } from './auth'",
          position: 'end',
          newline: true,
          indent: false,
        },
        {
          file: 'index.ts',
          marker: 'exports',
          content: 'export { auth }',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.success)).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toContain("import { auth } from './auth'")
    expect(content).toContain('export { auth }')
  })

  it('injects JSON into package.json', () => {
    const pkgFile = path.join(testDir, 'package.json')
    fs.writeFileSync(
      pkgFile,
      JSON.stringify(
        {
          name: 'test',
          scripts: { dev: 'npm run dev' },
        },
        null,
        2,
      ),
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'package.json',
          marker: 'json',
          json: { 'auth:keys': 'node generate-keys.js' },
          jsonPath: '$.scripts',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(true)

    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'))
    expect(pkg.scripts['auth:keys']).toBe('node generate-keys.js')
    expect(pkg.scripts.dev).toBe('npm run dev')
  })

  it('renders EJS templates in content', () => {
    const targetFile = path.join(testDir, 'config.ts')
    fs.writeFileSync(
      targetFile,
      `// BAKERY:INJECT:config
// BAKERY:END:config`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'config.ts',
          marker: 'config',
          content: "export const PROJECT = '<%= projectName %>'",
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toContain("export const PROJECT = 'test-project'")
  })

  it('preserves indentation from marker', () => {
    const targetFile = path.join(testDir, 'app.ts')
    fs.writeFileSync(
      targetFile,
      `function setup() {
    // BAKERY:INJECT:plugins
    // BAKERY:END:plugins
}`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'app.ts',
          marker: 'plugins',
          content: 'registerAuth()',
          position: 'end',
          newline: true,
          indent: true,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toContain('    registerAuth()')
  })

  it('fails gracefully when target file is missing', () => {
    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'nonexistent.ts',
          marker: 'test',
          content: 'content',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(false)
    expect(results[0]?.error).toContain('not found')
  })

  it('fails gracefully when marker is missing', () => {
    const targetFile = path.join(testDir, 'file.ts')
    fs.writeFileSync(targetFile, 'const x = 1')

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'file.ts',
          marker: 'nonexistent',
          content: 'content',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(false)
    expect(results[0]?.error).toContain('not found')
  })

  it('rejects injection that creates new markers (security)', () => {
    const targetFile = path.join(testDir, 'file.ts')
    fs.writeFileSync(
      targetFile,
      `// BAKERY:INJECT:safe
// BAKERY:END:safe`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'file.ts',
          marker: 'safe',
          content: '// BAKERY:INJECT:evil\n// BAKERY:END:evil',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'malicious',
      context,
    })

    expect(results[0]?.success).toBe(false)
    expect(results[0]?.error).toContain('create new markers')
  })

  it('handles Python-style markers', () => {
    const targetFile = path.join(testDir, 'config.py')
    fs.writeFileSync(
      targetFile,
      `# BAKERY:INJECT:imports
# BAKERY:END:imports

config = {}`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'config.py',
          marker: 'imports',
          content: 'import auth',
          position: 'end',
          newline: true,
          indent: false,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toContain('import auth')
  })

  it('handles HTML-style markers', () => {
    const targetFile = path.join(testDir, 'index.html')
    fs.writeFileSync(
      targetFile,
      `<head>
  <!-- BAKERY:INJECT:scripts -->
  <!-- BAKERY:END:scripts -->
</head>`,
    )

    const results = processInjections({
      projectDir: testDir,
      injections: [
        {
          file: 'index.html',
          marker: 'scripts',
          content: '<script src="auth.js"></script>',
          position: 'end',
          newline: true,
          indent: true,
        },
      ],
      addonName: 'auth',
      context,
    })

    expect(results[0]?.success).toBe(true)

    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toContain('<script src="auth.js"></script>')
  })
})
