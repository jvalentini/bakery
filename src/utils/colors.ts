const isColorSupported =
  process.env.FORCE_COLOR !== '0' &&
  (process.env.FORCE_COLOR === '1' ||
    process.env.COLORTERM !== undefined ||
    (process.stdout.isTTY && process.env.TERM !== 'dumb'));

function colorize(code: number, text: string): string {
  if (!isColorSupported) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

export function red(text: string): string {
  return colorize(31, text);
}

export function green(text: string): string {
  return colorize(32, text);
}

export function yellow(text: string): string {
  return colorize(33, text);
}

export function blue(text: string): string {
  return colorize(34, text);
}

export function magenta(text: string): string {
  return colorize(35, text);
}

export function cyan(text: string): string {
  return colorize(36, text);
}

export function dim(text: string): string {
  return colorize(2, text);
}

export function bold(text: string): string {
  return colorize(1, text);
}

export function error(text: string): string {
  return red(`error: ${text}`);
}

export function warning(text: string): string {
  return yellow(`warning: ${text}`);
}

export function success(text: string): string {
  return green(`success: ${text}`);
}

export function info(text: string): string {
  return blue(`info: ${text}`);
}
