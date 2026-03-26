/**
 * 日志工具
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_COLORS = {
  debug: '\x1b[36m',  // 青色
  info: '\x1b[32m',   // 绿色
  warn: '\x1b[33m',   // 黄色
  error: '\x1b[31m',  // 红色
  reset: '\x1b[0m'
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

class Logger {
  private level: LogLevel = 'info'
  
  setLevel(level: LogLevel): void {
    this.level = level
  }
  
  private formatTime(): string {
    return new Date().toISOString()
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }
  
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return
    
    const color = LOG_COLORS[level]
    const reset = LOG_COLORS.reset
    const time = this.formatTime()
    
    console.log(`${color}[${time}] [${level.toUpperCase()}]${reset} ${message}`, ...args)
  }
  
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args)
  }
  
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args)
  }
  
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args)
  }
  
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args)
  }
}

export const logger = new Logger()
