import chalk from 'chalk';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

const ICONS: Record<LogLevel, string> = {
  info: chalk.blue('ℹ'),
  success: chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
};

const PREFIX: Record<LogLevel, string> = {
  info: chalk.blue('[INFO]'),
  success: chalk.green('[OK]'),
  warn: chalk.yellow('[WARN]'),
  error: chalk.red('[ERROR]'),
};

export interface LoggerOptions {
  silent?: boolean;
  verbose?: boolean;
}

export class Logger {
  constructor(private readonly options: LoggerOptions = {}) {}

  info(message: string) {
    if (this.options.silent) return;
    console.log(`${ICONS.info} ${PREFIX.info} ${message}`);
  }

  success(message: string) {
    if (this.options.silent) return;
    console.log(`${ICONS.success} ${PREFIX.success} ${message}`);
  }

  warn(message: string) {
    if (this.options.silent) return;
    console.warn(`${ICONS.warn} ${PREFIX.warn} ${message}`);
  }

  error(message: string, error?: Error) {
    if (this.options.silent) return;
    console.error(`${ICONS.error} ${PREFIX.error} ${message}`);
    if (error && this.options.verbose) {
      console.error(error.stack ?? error.message);
    }
  }

  spinner(message: string) {
    if (this.options.silent) return;
    process.stdout.write(`${chalk.cyan('…')} ${message}\r`);
  }
}

export const globalLogger = new Logger();
