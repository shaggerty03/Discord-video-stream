import { inspect } from 'util';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<LogLevel, [number, string, typeof console.log]> = {
  trace: [0, '\x1b[90m', console.log],
  debug: [1, '\x1b[36m', console.log],
  info:  [2, '\x1b[32m', console.log],
  warn:  [3, '\x1b[33m', console.warn],
  error: [4, '\x1b[31m', console.error]
};

export class Logger {
  static globalLevel: LogLevel = 'info';
  private useColors: boolean;

  constructor(private namespace: string, private options: { level?: LogLevel, colors?: boolean } = {}) {
    this.useColors = this.options.colors ?? process.stdout.isTTY;
  }

  private log(level: LogLevel, msg: string, meta?: any) {
    if (LEVELS[level][0] >= LEVELS[this.options.level || Logger.globalLevel][0]) {
      const metaStr = meta ? ' ' + inspect(meta, { colors: this.useColors, depth: 4 }) : '';
      const base = `${new Date().toISOString()} ${level.toUpperCase()} [${this.namespace}]: ${msg}${metaStr}`;
      LEVELS[level][2](this.useColors ? `${LEVELS[level][1]}${base}\x1b[0m` : base);
    }
  }

  trace = (m: string, d?: any) => this.log('trace', m, d);
  debug = (m: string, d?: any) => this.log('debug', m, d);
  info = (m: string, d?: any) => this.log('info', m, d);
  warn = (m: string, d?: any) => this.log('warn', m, d);
  error = (m: string, d?: any) => this.log('error', m, d);
}