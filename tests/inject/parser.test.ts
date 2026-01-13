import { describe, expect, it } from 'bun:test'
import {
  detectCommentStyle,
  extractIndent,
  getMarkerNames,
  getMarkerPatterns,
  parseMarkers,
  validateMarkerPairs,
} from '../../src/inject/parser.js'
import { DuplicateMarkerError, MalformedMarkerError } from '../../src/utils/errors.js'

describe('detectCommentStyle', () => {
  it('detects JavaScript/TypeScript files', () => {
    expect(detectCommentStyle('file.ts')).toBe('js')
    expect(detectCommentStyle('file.tsx')).toBe('js')
    expect(detectCommentStyle('file.js')).toBe('js')
    expect(detectCommentStyle('file.jsx')).toBe('js')
    expect(detectCommentStyle('file.mjs')).toBe('js')
    expect(detectCommentStyle('file.json')).toBe('js')
  })

  it('detects Python/YAML/Shell files', () => {
    expect(detectCommentStyle('file.py')).toBe('python')
    expect(detectCommentStyle('file.yml')).toBe('python')
    expect(detectCommentStyle('file.yaml')).toBe('python')
    expect(detectCommentStyle('file.sh')).toBe('python')
    expect(detectCommentStyle('file.toml')).toBe('python')
  })

  it('detects HTML/XML files', () => {
    expect(detectCommentStyle('file.html')).toBe('html')
    expect(detectCommentStyle('file.htm')).toBe('html')
    expect(detectCommentStyle('file.xml')).toBe('html')
    expect(detectCommentStyle('file.svg')).toBe('html')
    expect(detectCommentStyle('file.md')).toBe('html')
  })

  it('detects CSS files', () => {
    expect(detectCommentStyle('file.css')).toBe('css')
    expect(detectCommentStyle('file.scss')).toBe('css')
    expect(detectCommentStyle('file.less')).toBe('css')
  })

  it('defaults to js for unknown extensions', () => {
    expect(detectCommentStyle('file.unknown')).toBe('js')
    expect(detectCommentStyle('file')).toBe('js')
  })
})

describe('getMarkerPatterns', () => {
  it('returns patterns for js style', () => {
    const patterns = getMarkerPatterns('js')
    expect('// BAKERY:INJECT:routes'.match(patterns.start)).toBeTruthy()
    expect('// BAKERY:END:routes'.match(patterns.end)).toBeTruthy()
  })

  it('returns patterns for python style', () => {
    const patterns = getMarkerPatterns('python')
    expect('# BAKERY:INJECT:deps'.match(patterns.start)).toBeTruthy()
    expect('# BAKERY:END:deps'.match(patterns.end)).toBeTruthy()
  })

  it('returns patterns for html style', () => {
    const patterns = getMarkerPatterns('html')
    expect('<!-- BAKERY:INJECT:scripts -->'.match(patterns.start)).toBeTruthy()
    expect('<!-- BAKERY:END:scripts -->'.match(patterns.end)).toBeTruthy()
  })

  it('returns patterns for css style', () => {
    const patterns = getMarkerPatterns('css')
    expect('/* BAKERY:INJECT:vars */'.match(patterns.start)).toBeTruthy()
    expect('/* BAKERY:END:vars */'.match(patterns.end)).toBeTruthy()
  })
})

describe('extractIndent', () => {
  it('extracts leading spaces', () => {
    expect(extractIndent('    code')).toBe('    ')
    expect(extractIndent('  code')).toBe('  ')
  })

  it('extracts leading tabs', () => {
    expect(extractIndent('\t\tcode')).toBe('\t\t')
  })

  it('extracts mixed whitespace', () => {
    expect(extractIndent('  \t  code')).toBe('  \t  ')
  })

  it('returns empty string for no indent', () => {
    expect(extractIndent('code')).toBe('')
    expect(extractIndent('')).toBe('')
  })
})

describe('parseMarkers', () => {
  it('parses a single marker pair in JS style', () => {
    const content = `import { foo } from 'bar'

// BAKERY:INJECT:routes
// BAKERY:END:routes

export default routes`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    expect(regions.size).toBe(1)

    const routes = regions.get('routes')
    expect(routes).toBeDefined()
    expect(routes?.name).toBe('routes')
    expect(routes?.startLine).toBe(2)
    expect(routes?.endLine).toBe(3)
    expect(routes?.indent).toBe('')
    expect(routes?.commentStyle).toBe('js')
  })

  it('parses marker pair with indentation', () => {
    const content = `function setup() {
  // BAKERY:INJECT:middleware
  // BAKERY:END:middleware
}`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    const middleware = regions.get('middleware')
    expect(middleware?.indent).toBe('  ')
  })

  it('parses multiple marker pairs', () => {
    const content = `// BAKERY:INJECT:imports
// BAKERY:END:imports

const routes = [
  // BAKERY:INJECT:routes
  // BAKERY:END:routes
]`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    expect(regions.size).toBe(2)
    expect(regions.has('imports')).toBe(true)
    expect(regions.has('routes')).toBe(true)
  })

  it('parses Python style markers', () => {
    const content = `# BAKERY:INJECT:deps
# BAKERY:END:deps`

    const result = parseMarkers(content, 'file.py')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    expect(regions.get('deps')?.commentStyle).toBe('python')
  })

  it('parses HTML style markers', () => {
    const content = `<!-- BAKERY:INJECT:head -->
<!-- BAKERY:END:head -->`

    const result = parseMarkers(content, 'file.html')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    expect(regions.get('head')?.commentStyle).toBe('html')
  })

  it('parses CSS style markers', () => {
    const content = `/* BAKERY:INJECT:variables */
/* BAKERY:END:variables */`

    const result = parseMarkers(content, 'file.css')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    expect(regions.get('variables')?.commentStyle).toBe('css')
  })

  it('captures content region indices correctly', () => {
    const content = `// BAKERY:INJECT:test
existing content
more content
// BAKERY:END:test`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    const test = regions.get('test')
    expect(test).toBeDefined()

    const regionContent = content.slice(test?.contentStartIndex, test?.contentEndIndex)
    expect(regionContent).toBe('existing content\nmore content\n')
  })

  it('errors on duplicate INJECT markers', () => {
    const content = `// BAKERY:INJECT:routes
// BAKERY:END:routes

// BAKERY:INJECT:routes
// BAKERY:END:routes`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateMarkerError)
  })

  it('errors on unmatched INJECT marker', () => {
    const content = `// BAKERY:INJECT:routes
some content`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MalformedMarkerError)
  })

  it('errors on unmatched END marker', () => {
    const content = `some content
// BAKERY:END:routes`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MalformedMarkerError)
  })

  it('errors on mismatched marker names', () => {
    const content = `// BAKERY:INJECT:routes
// BAKERY:END:middleware`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(MalformedMarkerError)
  })

  it('handles empty marker region', () => {
    const content = `// BAKERY:INJECT:empty
// BAKERY:END:empty`

    const result = parseMarkers(content, 'file.ts')
    expect(result.isOk()).toBe(true)

    const regions = result._unsafeUnwrap()
    const empty = regions.get('empty')
    expect(empty).toBeDefined()
    expect(empty?.contentStartIndex).toBe(empty?.contentEndIndex)
  })
})

describe('validateMarkerPairs', () => {
  it('returns ok for valid markers', () => {
    const content = `// BAKERY:INJECT:test
// BAKERY:END:test`

    const result = validateMarkerPairs(content, 'file.ts')
    expect(result.isOk()).toBe(true)
  })

  it('returns error for invalid markers', () => {
    const content = `// BAKERY:INJECT:test`

    const result = validateMarkerPairs(content, 'file.ts')
    expect(result.isErr()).toBe(true)
  })
})

describe('getMarkerNames', () => {
  it('returns all marker names in content', () => {
    const content = `// BAKERY:INJECT:imports
// BAKERY:END:imports

// BAKERY:INJECT:routes
// BAKERY:END:routes`

    const names = getMarkerNames(content)
    expect(names.size).toBe(2)
    expect(names.has('imports')).toBe(true)
    expect(names.has('routes')).toBe(true)
  })

  it('returns empty set for content without markers', () => {
    const content = `const x = 1`
    const names = getMarkerNames(content)
    expect(names.size).toBe(0)
  })
})
