import * as path from 'node:path'
import { err, ok, type Result } from 'neverthrow'
import { DuplicateMarkerError, MalformedMarkerError } from '../utils/errors.js'
import type { CommentStyle, MarkerRegion } from './types.js'

const MARKER_PATTERNS: Record<CommentStyle, { start: RegExp; end: RegExp }> = {
  js: {
    start: /^(\s*)\/\/\s*BAKERY:INJECT:([a-z0-9-]+)\s*$/,
    end: /^(\s*)\/\/\s*BAKERY:END:([a-z0-9-]+)\s*$/,
  },
  python: {
    start: /^(\s*)#\s*BAKERY:INJECT:([a-z0-9-]+)\s*$/,
    end: /^(\s*)#\s*BAKERY:END:([a-z0-9-]+)\s*$/,
  },
  html: {
    start: /^(\s*)<!--\s*BAKERY:INJECT:([a-z0-9-]+)\s*-->\s*$/,
    end: /^(\s*)<!--\s*BAKERY:END:([a-z0-9-]+)\s*-->\s*$/,
  },
  css: {
    start: /^(\s*)\/\*\s*BAKERY:INJECT:([a-z0-9-]+)\s*\*\/\s*$/,
    end: /^(\s*)\/\*\s*BAKERY:END:([a-z0-9-]+)\s*\*\/\s*$/,
  },
}

const EXTENSION_TO_STYLE: Record<string, CommentStyle> = {
  '.ts': 'js',
  '.tsx': 'js',
  '.js': 'js',
  '.jsx': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'js',
  '.py': 'python',
  '.yml': 'python',
  '.yaml': 'python',
  '.sh': 'python',
  '.bash': 'python',
  '.zsh': 'python',
  '.toml': 'python',
  '.ini': 'python',
  '.conf': 'python',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'html',
  '.svg': 'html',
  '.md': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
}

export function detectCommentStyle(filePath: string): CommentStyle {
  const ext = path.extname(filePath).toLowerCase()
  return EXTENSION_TO_STYLE[ext] ?? 'js'
}

export function getMarkerPatterns(style: CommentStyle): { start: RegExp; end: RegExp } {
  return MARKER_PATTERNS[style]
}

export function extractIndent(line: string): string {
  const match = line.match(/^(\s*)/)
  return match?.[1] ?? ''
}

interface ParsedMarker {
  type: 'start' | 'end'
  name: string
  indent: string
  lineNumber: number
  lineStartIndex: number
  lineEndIndex: number
  style: CommentStyle
}

function findAllMarkers(content: string): ParsedMarker[] {
  const lines = content.split('\n')
  const markers: ParsedMarker[] = []
  let charIndex = 0

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? ''
    const lineStartIndex = charIndex
    const lineEndIndex = charIndex + line.length

    for (const [style, patterns] of Object.entries(MARKER_PATTERNS) as [
      CommentStyle,
      { start: RegExp; end: RegExp },
    ][]) {
      const startMatch = line.match(patterns.start)
      if (startMatch) {
        markers.push({
          type: 'start',
          name: startMatch[2] ?? '',
          indent: startMatch[1] ?? '',
          lineNumber: lineNum,
          lineStartIndex,
          lineEndIndex,
          style,
        })
        break
      }

      const endMatch = line.match(patterns.end)
      if (endMatch) {
        markers.push({
          type: 'end',
          name: endMatch[2] ?? '',
          indent: endMatch[1] ?? '',
          lineNumber: lineNum,
          lineStartIndex,
          lineEndIndex,
          style,
        })
        break
      }
    }

    charIndex = lineEndIndex + 1
  }

  return markers
}

export function parseMarkers(
  content: string,
  filePath: string,
): Result<Map<string, MarkerRegion>, MalformedMarkerError | DuplicateMarkerError> {
  const allMarkers = findAllMarkers(content)
  const regions = new Map<string, MarkerRegion>()
  const startMarkers = new Map<string, ParsedMarker[]>()

  for (const marker of allMarkers) {
    if (marker.type === 'start') {
      const existing = startMarkers.get(marker.name) ?? []
      existing.push(marker)
      startMarkers.set(marker.name, existing)
    }
  }

  for (const [name, starts] of startMarkers) {
    if (starts.length > 1) {
      return err(
        new DuplicateMarkerError(
          filePath,
          name,
          starts.map((m) => m.lineNumber + 1),
        ),
      )
    }
  }

  const openStack: ParsedMarker[] = []

  for (const marker of allMarkers) {
    if (marker.type === 'start') {
      openStack.push(marker)
    } else {
      const lastOpen = openStack.pop()

      if (!lastOpen) {
        return err(
          new MalformedMarkerError(
            filePath,
            marker.name,
            `END marker without matching INJECT at line ${marker.lineNumber + 1}`,
          ),
        )
      }

      if (lastOpen.name !== marker.name) {
        return err(
          new MalformedMarkerError(
            filePath,
            marker.name,
            `Mismatched markers: INJECT:${lastOpen.name} at line ${lastOpen.lineNumber + 1} closed by END:${marker.name} at line ${marker.lineNumber + 1}`,
          ),
        )
      }

      regions.set(marker.name, {
        name: marker.name,
        startLine: lastOpen.lineNumber,
        endLine: marker.lineNumber,
        contentStartIndex: lastOpen.lineEndIndex + 1,
        contentEndIndex: marker.lineStartIndex,
        indent: lastOpen.indent,
        commentStyle: lastOpen.style,
      })
    }
  }

  if (openStack.length > 0) {
    const unclosed = openStack[0]
    if (unclosed) {
      return err(
        new MalformedMarkerError(
          filePath,
          unclosed.name,
          `INJECT marker without matching END at line ${unclosed.lineNumber + 1}`,
        ),
      )
    }
  }

  return ok(regions)
}

export function validateMarkerPairs(
  content: string,
  filePath: string,
): Result<void, MalformedMarkerError> {
  const result = parseMarkers(content, filePath)
  if (result.isErr()) {
    const error = result.error
    if (error instanceof MalformedMarkerError) {
      return err(error)
    }
    return err(new MalformedMarkerError(filePath, '', error.message))
  }
  return ok(undefined)
}

export function getMarkerNames(content: string): Set<string> {
  const allMarkers = findAllMarkers(content)
  const names = new Set<string>()
  for (const marker of allMarkers) {
    names.add(marker.name)
  }
  return names
}
