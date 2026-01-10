export class CliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliError'
  }
}

export class ArgumentError extends CliError {
  constructor(message: string) {
    super(message)
    this.name = 'ArgumentError'
  }
}

export class FileNotFoundError extends CliError {
  constructor(public readonly filepath: string) {
    super(`File not found: ${filepath}`)
    this.name = 'FileNotFoundError'
  }
}

export class FileReadError extends CliError {
  constructor(
    public readonly filepath: string,
    cause?: Error,
  ) {
    super(`Failed to read file: ${filepath}${cause ? ` - ${cause.message}` : ''}`)
    this.name = 'FileReadError'
  }
}

export class FileWriteError extends CliError {
  constructor(
    public readonly filepath: string,
    cause?: Error,
  ) {
    super(`Failed to write file: ${filepath}${cause ? ` - ${cause.message}` : ''}`)
    this.name = 'FileWriteError'
  }
}
