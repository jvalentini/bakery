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

export class InjectionError extends CliError {
  constructor(
    public readonly file: string,
    public readonly marker: string,
    message: string,
  ) {
    super(`Injection failed: ${message} (file: ${file}, marker: ${marker})`)
    this.name = 'InjectionError'
  }
}

export class MarkerNotFoundError extends InjectionError {
  constructor(file: string, marker: string) {
    super(file, marker, `Marker '${marker}' not found`)
    this.name = 'MarkerNotFoundError'
  }
}

export class MalformedMarkerError extends InjectionError {
  constructor(file: string, marker: string, detail: string) {
    super(file, marker, `Malformed marker: ${detail}`)
    this.name = 'MalformedMarkerError'
  }
}

export class DuplicateMarkerError extends InjectionError {
  constructor(file: string, marker: string, lines: number[]) {
    super(file, marker, `Duplicate marker found at lines ${lines.join(', ')}`)
    this.name = 'DuplicateMarkerError'
  }
}

export class MarkerSpoofingError extends InjectionError {
  constructor(file: string, marker: string, newMarkers: string[]) {
    super(file, marker, `Injection attempted to create new markers: ${newMarkers.join(', ')}`)
    this.name = 'MarkerSpoofingError'
  }
}
