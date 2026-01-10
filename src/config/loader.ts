import * as fs from 'node:fs'
import * as path from 'node:path'
import { err, ok, type Result } from 'neverthrow'
import { type ProjectConfig, ProjectConfigSchema } from './schema.js'

export interface ConfigLoadError {
  type: 'file_not_found' | 'parse_error' | 'validation_error'
  message: string
  details?: string[]
}

export function loadConfigFile(configPath: string): Result<ProjectConfig, ConfigLoadError> {
  const absolutePath = path.resolve(configPath)

  if (!fs.existsSync(absolutePath)) {
    return err({
      type: 'file_not_found',
      message: `Config file not found: ${absolutePath}`,
    })
  }

  let rawContent: string
  try {
    rawContent = fs.readFileSync(absolutePath, 'utf-8')
  } catch (e) {
    return err({
      type: 'file_not_found',
      message: `Failed to read config file: ${e instanceof Error ? e.message : String(e)}`,
    })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch (e) {
    return err({
      type: 'parse_error',
      message: `Invalid JSON in config file: ${e instanceof Error ? e.message : String(e)}`,
    })
  }

  const result = ProjectConfigSchema.safeParse(parsed)

  if (!result.success) {
    const details = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
    )

    return err({
      type: 'validation_error',
      message: 'Config file validation failed',
      details,
    })
  }

  return ok(result.data)
}

export function formatConfigError(error: ConfigLoadError): string {
  if (error.details && error.details.length > 0) {
    return `${error.message}\n${error.details.join('\n')}`
  }

  return error.message
}
