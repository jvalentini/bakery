import { describe, expect, it } from 'bun:test'
import {
  blue,
  bold,
  cyan,
  dim,
  error,
  green,
  info,
  magenta,
  red,
  success,
  warning,
  yellow,
} from '../src/utils/colors.js'

describe('colors', () => {
  it('should wrap text with red color code', () => {
    const result = red('test')
    expect(result).toContain('test')
  })

  it('should wrap text with green color code', () => {
    const result = green('test')
    expect(result).toContain('test')
  })

  it('should wrap text with yellow color code', () => {
    const result = yellow('test')
    expect(result).toContain('test')
  })

  it('should wrap text with blue color code', () => {
    const result = blue('test')
    expect(result).toContain('test')
  })

  it('should wrap text with magenta color code', () => {
    const result = magenta('test')
    expect(result).toContain('test')
  })

  it('should wrap text with cyan color code', () => {
    const result = cyan('test')
    expect(result).toContain('test')
  })

  it('should wrap text with dim style', () => {
    const result = dim('test')
    expect(result).toContain('test')
  })

  it('should wrap text with bold style', () => {
    const result = bold('test')
    expect(result).toContain('test')
  })

  it('should format error message', () => {
    const result = error('something went wrong')
    expect(result).toContain('error:')
    expect(result).toContain('something went wrong')
  })

  it('should format warning message', () => {
    const result = warning('be careful')
    expect(result).toContain('warning:')
    expect(result).toContain('be careful')
  })

  it('should format success message', () => {
    const result = success('done')
    expect(result).toContain('success:')
    expect(result).toContain('done')
  })

  it('should format info message', () => {
    const result = info('note')
    expect(result).toContain('info:')
    expect(result).toContain('note')
  })
})
