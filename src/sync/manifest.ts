import * as fs from 'node:fs'
import * as path from 'node:path'
import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'
import { FileReadError, FileWriteError } from '../utils/errors.js'
import { hashFile } from './hash.js'

const BAKERY_DIR = '.bakery'
const MANIFEST_FILE = 'manifest.json'

const MANAGED_PATTERNS = [
  'biome.json',
  'tsconfig.json',
  'lefthook.yml',
  '.github/',
  'Makefile',
  '.editorconfig',
  'knip.json',
  'commitlint.config.js',
  '.gitignore',
  'AGENTS.md',
]

const FileEntrySchema = z.object({
  hash: z.string(),
  managed: z.boolean(),
})

export type FileEntry = z.infer<typeof FileEntrySchema>

const ManifestSchema = z.object({
  bakeryVersion: z.string(),
  archetype: z.string(),
  addons: z.array(z.string()),
  generatedAt: z.string(),
  files: z.record(z.string(), FileEntrySchema),
})

export type Manifest = z.infer<typeof ManifestSchema>

export function isManaged(filePath: string): boolean {
  for (const pattern of MANAGED_PATTERNS) {
    if (pattern.endsWith('/')) {
      if (filePath.startsWith(pattern) || filePath === pattern.slice(0, -1)) {
        return true
      }
    } else if (filePath === pattern) {
      return true
    }
  }
  return false
}

export function getManifestPath(projectDir: string): string {
  return path.join(projectDir, BAKERY_DIR, MANIFEST_FILE)
}

export function loadManifest(projectDir: string): Result<Manifest, FileReadError> {
  const manifestPath = getManifestPath(projectDir)

  if (!fs.existsSync(manifestPath)) {
    return err(new FileReadError(manifestPath, new Error('Manifest not found')))
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8')
    const json = JSON.parse(content)
    const parsed = ManifestSchema.parse(json)
    return ok(parsed)
  } catch (error) {
    return err(new FileReadError(manifestPath, error instanceof Error ? error : undefined))
  }
}

export function saveManifest(projectDir: string, manifest: Manifest): Result<void, FileWriteError> {
  const bakeryDir = path.join(projectDir, BAKERY_DIR)
  const manifestPath = getManifestPath(projectDir)

  try {
    if (!fs.existsSync(bakeryDir)) {
      fs.mkdirSync(bakeryDir, { recursive: true })
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    return ok(undefined)
  } catch (error) {
    return err(new FileWriteError(manifestPath, error instanceof Error ? error : undefined))
  }
}

function collectFiles(dir: string, basePath: string = ''): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.bakery') {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...collectFiles(path.join(dir, entry.name), relativePath))
    } else if (entry.isFile()) {
      files.push(relativePath)
    }
  }

  return files
}

export interface CreateManifestOptions {
  bakeryVersion: string
  archetype: string
  addons: string[]
}

export function createManifest(
  projectDir: string,
  options: CreateManifestOptions,
): Result<Manifest, FileReadError> {
  const files = collectFiles(projectDir)
  const fileEntries: Record<string, FileEntry> = {}

  for (const filePath of files) {
    const fullPath = path.join(projectDir, filePath)
    const hashResult = hashFile(fullPath)

    if (hashResult.isErr()) {
      return err(new FileReadError(fullPath, hashResult.error))
    }

    fileEntries[filePath] = {
      hash: hashResult.value,
      managed: isManaged(filePath),
    }
  }

  const manifest: Manifest = {
    bakeryVersion: options.bakeryVersion,
    archetype: options.archetype,
    addons: options.addons,
    generatedAt: new Date().toISOString(),
    files: fileEntries,
  }

  return ok(manifest)
}

export interface FileChange {
  path: string
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  managed: boolean
  oldHash?: string
  newHash?: string
}

export function detectChanges(
  projectDir: string,
  manifest: Manifest,
): Result<FileChange[], FileReadError> {
  const changes: FileChange[] = []
  const currentFiles = new Set(collectFiles(projectDir))
  const manifestFiles = new Set(Object.keys(manifest.files))

  for (const filePath of currentFiles) {
    const fullPath = path.join(projectDir, filePath)
    const hashResult = hashFile(fullPath)

    if (hashResult.isErr()) {
      return err(new FileReadError(fullPath, hashResult.error))
    }

    const manifestEntry = manifest.files[filePath]

    if (!manifestEntry) {
      changes.push({
        path: filePath,
        type: 'added',
        managed: isManaged(filePath),
        newHash: hashResult.value,
      })
    } else if (manifestEntry.hash !== hashResult.value) {
      changes.push({
        path: filePath,
        type: 'modified',
        managed: manifestEntry.managed,
        oldHash: manifestEntry.hash,
        newHash: hashResult.value,
      })
    } else {
      changes.push({
        path: filePath,
        type: 'unchanged',
        managed: manifestEntry.managed,
        oldHash: manifestEntry.hash,
        newHash: hashResult.value,
      })
    }
  }

  for (const filePath of manifestFiles) {
    if (!currentFiles.has(filePath)) {
      const manifestEntry = manifest.files[filePath]
      if (manifestEntry) {
        changes.push({
          path: filePath,
          type: 'removed',
          managed: manifestEntry.managed,
          oldHash: manifestEntry.hash,
        })
      }
    }
  }

  return ok(changes)
}
