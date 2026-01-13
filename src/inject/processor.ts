import * as fs from 'node:fs'
import * as path from 'node:path'
import { err, ok, type Result } from 'neverthrow'
import { renderTemplate, type TemplateContext } from '../templates/engine.js'
import { InjectionError } from '../utils/errors.js'
import { injectContent, injectJson, validateNoNewMarkers } from './engine.js'
import type { InjectionDefinition, InjectionResult, ProcessInjectionsOptions } from './types.js'

function resolveInjectionContent(
  injection: InjectionDefinition,
  context: TemplateContext,
  templateBasePath?: string,
): Result<string, InjectionError> {
  const marker = injection.marker ?? 'unknown'

  if (injection.content !== undefined) {
    return ok(renderTemplate(injection.content, context))
  }

  if (injection.template !== undefined) {
    if (!templateBasePath) {
      return err(
        new InjectionError(
          injection.file,
          marker,
          'Template base path required for template injection',
        ),
      )
    }

    const templatePath = path.join(templateBasePath, injection.template)
    if (!fs.existsSync(templatePath)) {
      return err(
        new InjectionError(
          injection.file,
          marker,
          `Template file not found: ${injection.template}`,
        ),
      )
    }

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8')
      return ok(renderTemplate(templateContent, context))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return err(new InjectionError(injection.file, marker, `Failed to read template: ${message}`))
    }
  }

  return err(new InjectionError(injection.file, marker, 'No content, template, or json specified'))
}

function processSingleInjection(
  projectDir: string,
  injection: InjectionDefinition,
  addonName: string,
  context: TemplateContext,
  templateBasePath?: string,
): InjectionResult {
  const filePath = path.join(projectDir, injection.file)
  const marker = injection.marker ?? 'json'
  const result: InjectionResult = {
    file: injection.file,
    marker,
    addon: addonName,
    success: false,
    linesAdded: 0,
  }

  if (!fs.existsSync(filePath)) {
    result.error = `Target file not found: ${injection.file}`
    return result
  }

  let fileContent: string
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    result.error = `Failed to read file: ${message}`
    return result
  }

  if (injection.json !== undefined) {
    const jsonResult = injectJson(fileContent, injection.jsonPath, injection.json, injection.file)
    if (jsonResult.isErr()) {
      result.error = jsonResult.error.message
      return result
    }

    const newContent = jsonResult.value
    const linesAdded = newContent.split('\n').length - fileContent.split('\n').length

    try {
      fs.writeFileSync(filePath, newContent)
      result.success = true
      result.linesAdded = linesAdded
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.error = `Failed to write file: ${message}`
    }

    return result
  }

  const contentResult = resolveInjectionContent(injection, context, templateBasePath)
  if (contentResult.isErr()) {
    result.error = contentResult.error.message
    return result
  }

  const injectionContent = contentResult.value
  const beforeContent = fileContent

  const injectResult = injectContent(
    fileContent,
    marker,
    injectionContent,
    {
      position: injection.position,
      newline: injection.newline,
      indent: injection.indent,
    },
    injection.file,
  )

  if (injectResult.isErr()) {
    result.error = injectResult.error.message
    return result
  }

  const newContent = injectResult.value

  const securityResult = validateNoNewMarkers(beforeContent, newContent, injection.file, marker)
  if (securityResult.isErr()) {
    result.error = securityResult.error.message
    return result
  }

  const linesAdded = injectionContent.split('\n').length - (injectionContent.endsWith('\n') ? 1 : 0)

  try {
    fs.writeFileSync(filePath, newContent)
    result.success = true
    result.linesAdded = linesAdded
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    result.error = `Failed to write file: ${message}`
  }

  return result
}

export function processInjections(options: ProcessInjectionsOptions): InjectionResult[] {
  const { projectDir, injections, addonName, context, templateBasePath } = options
  const results: InjectionResult[] = []

  const fullContext = context as unknown as TemplateContext

  for (const injection of injections) {
    const result = processSingleInjection(
      projectDir,
      injection,
      addonName,
      fullContext,
      templateBasePath,
    )
    results.push(result)
  }

  return results
}
