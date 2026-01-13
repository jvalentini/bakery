import { describe, expect, it } from 'bun:test'
import {
  deepMergeJson,
  injectContent,
  injectJson,
  validateNoNewMarkers,
} from '../../src/inject/engine.js'
import { MarkerNotFoundError, MarkerSpoofingError } from '../../src/utils/errors.js'

describe('injectContent', () => {
  const baseContent = `import { foo } from 'bar'

// BAKERY:INJECT:routes
// BAKERY:END:routes

export default routes`

  it('injects content at end position (default)', () => {
    const result = injectContent(
      baseContent,
      'routes',
      "{ path: '/auth', handler: auth },",
      { position: 'end', newline: true, indent: false },
      'file.ts',
    )

    expect(result.isOk()).toBe(true)
    const content = result._unsafeUnwrap()
    expect(content).toContain("{ path: '/auth', handler: auth },")
    expect(content).toContain('// BAKERY:INJECT:routes')
    expect(content).toContain('// BAKERY:END:routes')
  })

  it('injects content at start position', () => {
    const contentWithExisting = `// BAKERY:INJECT:routes
{ path: '/', handler: home },
// BAKERY:END:routes`

    const result = injectContent(
      contentWithExisting,
      'routes',
      "{ path: '/first', handler: first },",
      { position: 'start', newline: true, indent: false },
      'file.ts',
    )

    expect(result.isOk()).toBe(true)
    const content = result._unsafeUnwrap()

    const lines = content.split('\n')
    const firstIndex = lines.findIndex((l) => l.includes('/first'))
    const homeIndex = lines.findIndex((l) => l.includes('home'))
    expect(firstIndex).toBeLessThan(homeIndex)
  })

  it('applies indentation when indent is true', () => {
    const indentedContent = `function setup() {
  // BAKERY:INJECT:middleware
  // BAKERY:END:middleware
}`

    const result = injectContent(
      indentedContent,
      'middleware',
      'app.use(auth)',
      { position: 'end', newline: true, indent: true },
      'file.ts',
    )

    expect(result.isOk()).toBe(true)
    const content = result._unsafeUnwrap()
    expect(content).toContain('  app.use(auth)')
  })

  it('adds newline when newline is true', () => {
    const result = injectContent(
      baseContent,
      'routes',
      'route1',
      { position: 'end', newline: true, indent: false },
      'file.ts',
    )

    expect(result.isOk()).toBe(true)
    const content = result._unsafeUnwrap()
    expect(content).toContain('route1\n')
  })

  it('does not add newline when newline is false and content has no trailing newline', () => {
    const result = injectContent(
      baseContent,
      'routes',
      'route1',
      { position: 'end', newline: false, indent: false },
      'file.ts',
    )

    expect(result.isOk()).toBe(true)
    const content = result._unsafeUnwrap()
    expect(content).toContain('route1// BAKERY:END')
  })

  it('errors on non-existent marker', () => {
    const result = injectContent(
      baseContent,
      'nonexistent',
      'content',
      { position: 'end', newline: true, indent: false },
      'file.ts',
    )

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MarkerNotFoundError)
  })

  it('handles multiple injections to same marker', () => {
    let content = baseContent

    const result1 = injectContent(
      content,
      'routes',
      'route1,',
      { position: 'end', newline: true, indent: false },
      'file.ts',
    )
    expect(result1.isOk()).toBe(true)
    content = result1._unsafeUnwrap()

    const result2 = injectContent(
      content,
      'routes',
      'route2,',
      { position: 'end', newline: true, indent: false },
      'file.ts',
    )
    expect(result2.isOk()).toBe(true)
    content = result2._unsafeUnwrap()

    expect(content).toContain('route1,')
    expect(content).toContain('route2,')
  })

  it('preserves content outside marker region', () => {
    const result = injectContent(
      baseContent,
      'routes',
      'injected',
      { position: 'end', newline: true, indent: false },
      'file.ts',
    )

    expect(result.isOk()).toBe(true)
    const content = result._unsafeUnwrap()
    expect(content).toContain("import { foo } from 'bar'")
    expect(content).toContain('export default routes')
  })
})

describe('deepMergeJson', () => {
  it('merges flat objects', () => {
    const target = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }
    const result = deepMergeJson(target, source)

    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('deep merges nested objects', () => {
    const target = { scripts: { dev: 'npm run dev', test: 'npm test' } }
    const source = { scripts: { build: 'npm run build' } }
    const result = deepMergeJson(target, source)

    expect(result).toEqual({
      scripts: { dev: 'npm run dev', test: 'npm test', build: 'npm run build' },
    })
  })

  it('concatenates and deduplicates arrays', () => {
    const target = { deps: ['a', 'b'] }
    const source = { deps: ['b', 'c'] }
    const result = deepMergeJson(target, source)

    expect(result).toEqual({ deps: ['a', 'b', 'c'] })
  })

  it('source primitive overrides target', () => {
    const target = { version: '1.0.0' }
    const source = { version: '2.0.0' }
    const result = deepMergeJson(target, source)

    expect(result).toEqual({ version: '2.0.0' })
  })

  it('does not mutate original objects', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    deepMergeJson(target, source)

    expect(target).toEqual({ a: 1 })
    expect(source).toEqual({ b: 2 })
  })

  it('handles deeply nested structures', () => {
    const target = { a: { b: { c: 1 } } }
    const source = { a: { b: { d: 2 } } }
    const result = deepMergeJson(target, source)

    expect(result).toEqual({ a: { b: { c: 1, d: 2 } } })
  })
})

describe('injectJson', () => {
  it('merges JSON at root level without jsonPath', () => {
    const content = JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
    const result = injectJson(content, undefined, { author: 'me' }, 'package.json')

    expect(result.isOk()).toBe(true)
    const parsed = JSON.parse(result._unsafeUnwrap())
    expect(parsed).toEqual({ name: 'test', version: '1.0.0', author: 'me' })
  })

  it('merges JSON at specific path with jsonPath', () => {
    const content = JSON.stringify({ scripts: { dev: 'npm run dev' }, dependencies: {} }, null, 2)
    const result = injectJson(content, '$.scripts', { build: 'npm run build' }, 'package.json')

    expect(result.isOk()).toBe(true)
    const parsed = JSON.parse(result._unsafeUnwrap())
    expect(parsed.scripts).toEqual({ dev: 'npm run dev', build: 'npm run build' })
    expect(parsed.dependencies).toEqual({})
  })

  it('creates nested path if it does not exist', () => {
    const content = JSON.stringify({ name: 'test' }, null, 2)
    const result = injectJson(content, '$.scripts', { dev: 'npm run dev' }, 'package.json')

    expect(result.isOk()).toBe(true)
    const parsed = JSON.parse(result._unsafeUnwrap())
    expect(parsed).toEqual({ name: 'test', scripts: { dev: 'npm run dev' } })
  })

  it('handles deeply nested jsonPath', () => {
    const content = JSON.stringify({ a: { b: {} } }, null, 2)
    const result = injectJson(content, '$.a.b', { c: 1 }, 'file.json')

    expect(result.isOk()).toBe(true)
    const parsed = JSON.parse(result._unsafeUnwrap())
    expect(parsed).toEqual({ a: { b: { c: 1 } } })
  })

  it('errors on invalid JSON content', () => {
    const result = injectJson('not valid json', undefined, { a: 1 }, 'file.json')

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Failed to parse JSON')
  })

  it('outputs formatted JSON with trailing newline', () => {
    const content = JSON.stringify({ a: 1 })
    const result = injectJson(content, undefined, { b: 2 }, 'file.json')

    expect(result.isOk()).toBe(true)
    const output = result._unsafeUnwrap()
    expect(output.endsWith('\n')).toBe(true)
    expect(output).toContain('  ')
  })
})

describe('validateNoNewMarkers', () => {
  it('returns ok when no new markers are created', () => {
    const before = `// BAKERY:INJECT:test
// BAKERY:END:test`

    const after = `// BAKERY:INJECT:test
some content
// BAKERY:END:test`

    const result = validateNoNewMarkers(before, after, 'file.ts', 'test')
    expect(result.isOk()).toBe(true)
  })

  it('errors when injection creates new markers', () => {
    const before = `// BAKERY:INJECT:test
// BAKERY:END:test`

    const after = `// BAKERY:INJECT:test
// BAKERY:INJECT:evil
// BAKERY:END:evil
// BAKERY:END:test`

    const result = validateNoNewMarkers(before, after, 'file.ts', 'test')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MarkerSpoofingError)
  })

  it('ignores existing markers', () => {
    const before = `// BAKERY:INJECT:existing
// BAKERY:END:existing

// BAKERY:INJECT:test
// BAKERY:END:test`

    const after = `// BAKERY:INJECT:existing
// BAKERY:END:existing

// BAKERY:INJECT:test
injected content
// BAKERY:END:test`

    const result = validateNoNewMarkers(before, after, 'file.ts', 'test')
    expect(result.isOk()).toBe(true)
  })
})
