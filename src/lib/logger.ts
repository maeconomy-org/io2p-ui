import * as Sentry from '@sentry/nextjs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableSentry: boolean
}

// LogContext can be any data - flexible for logging
type LogContext = Record<string, unknown> | unknown

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production'

// Global logger configuration - simplified
// In dev: console only, no Sentry (SENTRY_ENABLED=false by default)
// In prod: Sentry for errors/warnings, console for errors only
let loggerConfig: LoggerConfig = {
  level:
    (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'warn' : 'info'),
  // Console: always enabled in dev, errors only in prod
  enableConsole: !isProduction || process.env.LOG_LEVEL === 'debug',
  // Sentry: only when explicitly enabled (default false in dev)
  enableSentry: process.env.SENTRY_ENABLED === 'true',
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const currentLevelIndex = levels.indexOf(loggerConfig.level)
  const messageLevelIndex = levels.indexOf(level)
  return messageLevelIndex >= currentLevelIndex
}

function logToConsole(level: LogLevel, message: string, context?: LogContext) {
  if (!loggerConfig.enableConsole) return

  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  const contextStr = context ? JSON.stringify(context) : ''

  switch (level) {
    case 'debug':
      console.debug(prefix, message, contextStr)
      break
    case 'info':
      console.info(prefix, message, contextStr)
      break
    case 'warn':
      console.warn(prefix, message, contextStr)
      break
    case 'error':
      console.error(prefix, message, contextStr)
      break
  }
}

function logToSentry(level: LogLevel, message: string, context?: LogContext) {
  if (!loggerConfig.enableSentry) return

  // Only send errors and warnings to Sentry to reduce noise
  if (level !== 'error' && level !== 'warn') return

  // Map our log levels to Sentry severity levels
  const sentryLevel: 'warning' | 'error' =
    level === 'warn' ? 'warning' : 'error'

  // Wrap context in object if needed for Sentry
  const extra =
    context && typeof context === 'object' && !Array.isArray(context)
      ? (context as Record<string, unknown>)
      : { data: context }

  if (level === 'error') {
    Sentry.captureException(new Error(message), {
      extra,
      level: sentryLevel,
    })
  } else {
    // Use Sentry's native logger for warnings (requires enableLogs: true in Sentry init)
    Sentry.addBreadcrumb({
      message,
      level: sentryLevel,
      data: extra,
      timestamp: Date.now() / 1000,
    })
  }
}

// Main logging functions
function debug(message: string, context?: LogContext) {
  if (!shouldLog('debug')) return
  logToConsole('debug', message, context)
  logToSentry('debug', message, context)
}

function info(message: string, context?: LogContext) {
  if (!shouldLog('info')) return
  logToConsole('info', message, context)
  logToSentry('info', message, context)
}

function warn(message: string, context?: LogContext) {
  if (!shouldLog('warn')) return
  logToConsole('warn', message, context)
  logToSentry('warn', message, context)
}

function error(message: string, context?: LogContext) {
  if (!shouldLog('error')) return
  logToConsole('error', message, context)
  logToSentry('error', message, context)
}

// Security-specific logging
function security(
  event: string,
  details: Record<string, unknown>,
  level: LogLevel = 'warn'
) {
  const message = `[SECURITY] ${event}`
  const context = {
    category: 'security',
    event,
    timestamp: new Date().toISOString(),
    ...details,
  }

  switch (level) {
    case 'debug':
      debug(message, context)
      break
    case 'info':
      info(message, context)
      break
    case 'warn':
      warn(message, context)
      break
    case 'error':
      error(message, context)
      break
  }
}

// Import-specific logging
function importLog(
  event: string,
  details: Record<string, unknown>,
  level: LogLevel = 'info'
) {
  const message = `[IMPORT] ${event}`
  const context = {
    category: 'import',
    event,
    timestamp: new Date().toISOString(),
    ...details,
  }

  switch (level) {
    case 'debug':
      debug(message, context)
      break
    case 'info':
      info(message, context)
      break
    case 'warn':
      warn(message, context)
      break
    case 'error':
      error(message, context)
      break
  }
}

// Configuration functions
function updateConfig(newConfig: Partial<LoggerConfig>) {
  loggerConfig = { ...loggerConfig, ...newConfig }
}

function getConfig(): LoggerConfig {
  return { ...loggerConfig }
}

// Export functional logger interface
export const logger = {
  debug,
  info,
  warn,
  error,
  security,
  import: importLog,
  updateConfig,
  getConfig,
}

// These provide a drop-in replacement for console methods
export const log = {
  debug: (message: string, ...args: any[]) => {
    const context = args.length > 0 ? { args } : undefined
    debug(message, context)
  },
  info: (message: string, ...args: any[]) => {
    const context = args.length > 0 ? { args } : undefined
    info(message, context)
  },
  warn: (message: string, ...args: any[]) => {
    const context = args.length > 0 ? { args } : undefined
    warn(message, context)
  },
  error: (message: string, ...args: any[]) => {
    const context = args.length > 0 ? { args } : undefined
    error(message, context)
  },
}
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>,
  level: LogLevel = 'warn'
) {
  logger.security(event, details, level)
}
