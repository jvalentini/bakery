/**
 * Hash utilities for file content hashing and comparison
 *
 * @module
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import { err, ok, type Result } from 'neverthrow'
import { FileNotFoundError, FileReadError } from '../utils/errors.js'

/**
 * Compute SHA-256 hash of a string or buffer
 */
export function hashContent(content: string | Buffer): string {
  const hash = createHash('sha256')
  hash.update(content)
  return hash.digest('hex')
}

/**
 * Compute SHA-256 hash of a file's contents
 */
export function hashFile(filePath: string): Result<string, FileNotFoundError | FileReadError> {
  if (!fs.existsSync(filePath)) {
    return err(new FileNotFoundError(filePath))
  }

  try {
    const content = fs.readFileSync(filePath)
    return ok(hashContent(content))
  } catch (error) {
    return err(new FileReadError(filePath, error instanceof Error ? error : undefined))
  }
}

/**
 * Compute SHA-256 hashes for multiple files
 * Returns a map of relative paths to hashes
 */
export function hashFiles(
  basePath: string,
  relativePaths: string[],
): Result<Map<string, string>, FileNotFoundError | FileReadError> {
  const hashes = new Map<string, string>()

  for (const relativePath of relativePaths) {
    const fullPath = `${basePath}/${relativePath}`
    const result = hashFile(fullPath)

    if (result.isErr()) {
      return err(result.error)
    }

    hashes.set(relativePath, result.value)
  }

  return ok(hashes)
}

/**
 * Compare two hashes for equality
 */
export function hashesMatch(hash1: string, hash2: string): boolean {
  return hash1 === hash2
}

/**
 * Format a hash for display (first 8 characters)
 */
export function formatHash(hash: string): string {
  return hash.slice(0, 8)
}
