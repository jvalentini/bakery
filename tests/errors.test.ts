import { describe, expect, it } from 'bun:test';
import {
  ArgumentError,
  CliError,
  FileNotFoundError,
  FileReadError,
  FileWriteError,
} from '../src/utils/errors.js';

describe('errors', () => {
  describe('CliError', () => {
    it('should create error with message', () => {
      const err = new CliError('test error');
      expect(err.message).toBe('test error');
      expect(err.name).toBe('CliError');
    });

    it('should be instanceof Error', () => {
      const err = new CliError('test');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('ArgumentError', () => {
    it('should create error with message', () => {
      const err = new ArgumentError('invalid argument');
      expect(err.message).toBe('invalid argument');
      expect(err.name).toBe('ArgumentError');
    });

    it('should be instanceof CliError', () => {
      const err = new ArgumentError('test');
      expect(err).toBeInstanceOf(CliError);
    });
  });

  describe('FileNotFoundError', () => {
    it('should create error with filepath', () => {
      const err = new FileNotFoundError('/path/to/file.txt');
      expect(err.message).toContain('/path/to/file.txt');
      expect(err.filepath).toBe('/path/to/file.txt');
      expect(err.name).toBe('FileNotFoundError');
    });
  });

  describe('FileReadError', () => {
    it('should create error with filepath', () => {
      const err = new FileReadError('/path/to/file.txt');
      expect(err.message).toContain('/path/to/file.txt');
      expect(err.filepath).toBe('/path/to/file.txt');
      expect(err.name).toBe('FileReadError');
    });

    it('should include cause message when provided', () => {
      const cause = new Error('permission denied');
      const err = new FileReadError('/path/to/file.txt', cause);
      expect(err.message).toContain('permission denied');
    });
  });

  describe('FileWriteError', () => {
    it('should create error with filepath', () => {
      const err = new FileWriteError('/path/to/file.txt');
      expect(err.message).toContain('/path/to/file.txt');
      expect(err.filepath).toBe('/path/to/file.txt');
      expect(err.name).toBe('FileWriteError');
    });

    it('should include cause message when provided', () => {
      const cause = new Error('disk full');
      const err = new FileWriteError('/path/to/file.txt', cause);
      expect(err.message).toContain('disk full');
    });
  });
});
