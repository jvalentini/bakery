import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { formatHash, hashContent, hashesMatch, hashFile, hashFiles } from '../src/sync/hash.js'

describe('Hash Utilities', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-hash-test-'))
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe('hashContent', () => {
    it('should hash a string', () => {
      const hash = hashContent('hello world')
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('should hash a buffer', () => {
      const buffer = Buffer.from('hello world', 'utf-8')
      const hash = hashContent(buffer)
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('should produce different hashes for different content', () => {
      const hash1 = hashContent('hello')
      const hash2 = hashContent('world')
      expect(hash1).not.toBe(hash2)
    })

    it('should produce same hash for same content', () => {
      const hash1 = hashContent('test content')
      const hash2 = hashContent('test content')
      expect(hash1).toBe(hash2)
    })

    it('should hash empty string', () => {
      const hash = hashContent('')
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })

    it('should hash empty buffer', () => {
      const hash = hashContent(Buffer.from(''))
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })
  })

  describe('hashFile', () => {
    it('should hash an existing file', () => {
      const filePath = path.join(testDir, 'test.txt')
      fs.writeFileSync(filePath, 'hello world')

      const result = hashFile(filePath)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(
          'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
        )
      }
    })

    it('should return error for non-existent file', () => {
      const filePath = path.join(testDir, 'nonexistent.txt')

      const result = hashFile(filePath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('File not found')
        expect(result.error.filepath).toBe(filePath)
      }
    })

    // Skip in Docker/root environments where chmod doesn't prevent root from reading
    it.skipIf(process.getuid?.() === 0)('should return error for unreadable file', () => {
      const filePath = path.join(testDir, 'unreadable.txt')
      fs.writeFileSync(filePath, 'content')
      fs.chmodSync(filePath, 0o000)

      const result = hashFile(filePath)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('Failed to read file')
      }

      fs.chmodSync(filePath, 0o644)
    })

    it('should hash binary files correctly', () => {
      const filePath = path.join(testDir, 'binary.bin')
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff])
      fs.writeFileSync(filePath, buffer)

      const result = hashFile(filePath)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(hashContent(buffer))
      }
    })

    it('should hash large files', () => {
      const filePath = path.join(testDir, 'large.txt')
      const content = 'x'.repeat(10000)
      fs.writeFileSync(filePath, content)

      const result = hashFile(filePath)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(hashContent(content))
      }
    })
  })

  describe('hashFiles', () => {
    it('should hash multiple files successfully', () => {
      const basePath = testDir
      fs.writeFileSync(path.join(basePath, 'file1.txt'), 'content1')
      fs.writeFileSync(path.join(basePath, 'file2.txt'), 'content2')

      const result = hashFiles(basePath, ['file1.txt', 'file2.txt'])

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.size).toBe(2)
        expect(result.value.has('file1.txt')).toBe(true)
        expect(result.value.has('file2.txt')).toBe(true)
        expect(result.value.get('file1.txt')).toBe(hashContent('content1'))
        expect(result.value.get('file2.txt')).toBe(hashContent('content2'))
      }
    })

    it('should handle subdirectory paths', () => {
      const basePath = testDir
      const subdir = path.join(basePath, 'subdir')
      fs.mkdirSync(subdir)
      fs.writeFileSync(path.join(subdir, 'file.txt'), 'content')

      const result = hashFiles(basePath, ['subdir/file.txt'])

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.size).toBe(1)
        expect(result.value.has('subdir/file.txt')).toBe(true)
      }
    })

    it('should return error if any file fails', () => {
      const basePath = testDir
      fs.writeFileSync(path.join(basePath, 'file1.txt'), 'content1')

      const result = hashFiles(basePath, ['file1.txt', 'nonexistent.txt'])

      expect(result.isErr()).toBe(true)
    })

    it('should handle empty file list', () => {
      const result = hashFiles(testDir, [])

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.size).toBe(0)
      }
    })

    it('should preserve relative path keys in map', () => {
      const basePath = testDir
      fs.writeFileSync(path.join(basePath, 'a.txt'), 'a')

      const result = hashFiles(basePath, ['a.txt'])

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(Array.from(result.value.keys())).toEqual(['a.txt'])
      }
    })
  })

  describe('hashesMatch', () => {
    it('should return true for identical hashes', () => {
      const hash = hashContent('test')
      expect(hashesMatch(hash, hash)).toBe(true)
    })

    it('should return false for different hashes', () => {
      const hash1 = hashContent('test1')
      const hash2 = hashContent('test2')
      expect(hashesMatch(hash1, hash2)).toBe(false)
    })

    it('should be case-sensitive', () => {
      const hash1 = 'abc123'
      const hash2 = 'ABC123'
      expect(hashesMatch(hash1, hash2)).toBe(false)
    })
  })

  describe('formatHash', () => {
    it('should return first 8 characters', () => {
      const hash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      expect(formatHash(hash)).toBe('b94d27b9')
    })

    it('should handle short hashes', () => {
      const hash = 'abc'
      expect(formatHash(hash)).toBe('abc')
    })

    it('should handle empty hash', () => {
      expect(formatHash('')).toBe('')
    })

    it('should not modify hashes shorter than 8 characters', () => {
      const hash = '1234567'
      expect(formatHash(hash)).toBe('1234567')
    })
  })
})
