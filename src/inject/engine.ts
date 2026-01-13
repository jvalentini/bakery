import { err, ok, type Result } from 'neverthrow'
import { InjectionError, MarkerNotFoundError, MarkerSpoofingError } from '../utils/errors.js'
import { getMarkerNames, parseMarkers } from './parser.js'
import type { InjectionPosition } from './types.js'

export interface InjectContentOptions {
  position: InjectionPosition
  newline: boolean
  indent: boolean
}

function applyIndent(content: string, indent: string): string {
  if (!indent) return content
  const lines = content.split('\n')
  return lines
    .map((line, i) => (line.length > 0 || i < lines.length - 1 ? indent + line : line))
    .join('\n')
}

export function injectContent(
  fileContent: string,
  marker: string,
  injection: string,
  options: InjectContentOptions,
  filePath: string,
): Result<string, InjectionError> {
  const markersResult = parseMarkers(fileContent, filePath)
  if (markersResult.isErr()) {
    return err(markersResult.error)
  }

  const regions = markersResult.value
  const region = regions.get(marker)

  if (!region) {
    return err(new MarkerNotFoundError(filePath, marker))
  }

  let processedInjection = injection

  if (options.indent && region.indent) {
    processedInjection = applyIndent(processedInjection, region.indent)
  }

  if (options.newline && !processedInjection.endsWith('\n')) {
    processedInjection += '\n'
  }

  const before = fileContent.slice(0, region.contentStartIndex)
  const existingContent = fileContent.slice(region.contentStartIndex, region.contentEndIndex)
  const after = fileContent.slice(region.contentEndIndex)

  let newContent: string
  if (options.position === 'start') {
    newContent = before + processedInjection + existingContent + after
  } else {
    newContent = before + existingContent + processedInjection + after
  }

  return ok(newContent)
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val)
}

export function deepMergeJson(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = result[key]

    if (isObject(sourceVal) && isObject(targetVal)) {
      result[key] = deepMergeJson(targetVal, sourceVal)
    } else if (isArray(sourceVal) && isArray(targetVal)) {
      const combined = [...targetVal, ...sourceVal]
      const seen = new Set<string>()
      const deduped: unknown[] = []
      for (const item of combined) {
        const key = JSON.stringify(item)
        if (!seen.has(key)) {
          seen.add(key)
          deduped.push(item)
        }
      }
      result[key] = deduped
    } else {
      result[key] = sourceVal
    }
  }

  return result
}

function parseJsonPath(jsonPath: string): string[] {
  if (!jsonPath.startsWith('$.')) {
    return [jsonPath]
  }
  return jsonPath.slice(2).split('.')
}

function getNestedValue(obj: Record<string, unknown>, pathParts: string[]): unknown {
  let current: unknown = obj
  for (const part of pathParts) {
    if (!isObject(current)) return undefined
    current = current[part]
  }
  return current
}

function setNestedValue(
  obj: Record<string, unknown>,
  pathParts: string[],
  value: unknown,
): Record<string, unknown> {
  if (pathParts.length === 0) {
    if (isObject(value)) return value as Record<string, unknown>
    return obj
  }

  const result = { ...obj }
  const [first, ...rest] = pathParts

  if (!first) return result

  if (rest.length === 0) {
    result[first] = value
  } else {
    const existing = result[first]
    result[first] = setNestedValue(isObject(existing) ? existing : {}, rest, value)
  }

  return result
}

export function injectJson(
  fileContent: string,
  jsonPath: string | undefined,
  jsonToMerge: Record<string, unknown>,
  filePath: string,
): Result<string, InjectionError> {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(fileContent) as Record<string, unknown>
  } catch {
    return err(new InjectionError(filePath, 'json', `Failed to parse JSON in ${filePath}`))
  }

  let result: Record<string, unknown>

  if (jsonPath) {
    const pathParts = parseJsonPath(jsonPath)
    const existingValue = getNestedValue(parsed, pathParts)

    if (isObject(existingValue)) {
      const merged = deepMergeJson(existingValue, jsonToMerge)
      result = setNestedValue(parsed, pathParts, merged)
    } else {
      result = setNestedValue(parsed, pathParts, jsonToMerge)
    }
  } else {
    result = deepMergeJson(parsed, jsonToMerge)
  }

  return ok(`${JSON.stringify(result, null, 2)}\n`)
}

export function validateNoNewMarkers(
  beforeContent: string,
  afterContent: string,
  filePath: string,
  currentMarker: string,
): Result<void, MarkerSpoofingError> {
  const markersBefore = getMarkerNames(beforeContent)
  const markersAfter = getMarkerNames(afterContent)

  const newMarkers: string[] = []
  for (const marker of markersAfter) {
    if (!markersBefore.has(marker)) {
      newMarkers.push(marker)
    }
  }

  if (newMarkers.length > 0) {
    return err(new MarkerSpoofingError(filePath, currentMarker, newMarkers))
  }

  return ok(undefined)
}
