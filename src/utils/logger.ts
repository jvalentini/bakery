import { blue, dim, red, yellow } from './colors.js';

interface LoggerConfig {
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

let config: LoggerConfig = {};

export const Logger = {
  configure(options: LoggerConfig): void {
    config = { ...options };
  },

  info(message: string, ...args: unknown[]): void {
    if (config.quiet) return;
    console.error(blue('info:'), message, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    if (config.quiet) return;
    console.error(yellow('warn:'), message, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(red('error:'), message, ...args);
  },

  verbose(message: string, ...args: unknown[]): void {
    if (!config.verbose || config.quiet) return;
    console.error(dim('verbose:'), message, ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (!config.debug) return;
    console.error(dim('debug:'), message, ...args);
  },

  log(message: string, ...args: unknown[]): void {
    if (config.quiet) return;
    console.log(message, ...args);
  },
};
