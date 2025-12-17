import * as Sentry from '@sentry/nextjs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogDestination = 'console' | 'sentry' | 'sdk' | 'none'

interface LoggerConfig {
  level: LogLevel
  destinations: LogDestination[]
  enableConsole: boolean
  enableSentry: boolean
  enableSdk: boolean
}

interface LogContext {
  [key: string]: any
}

// Global logger configuration
let loggerConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  destinations: parseDestinations(
    process.env.LOG_DESTINATIONS || 'console,sentry'
  ),
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableSentry: process.env.SENTRY_ENABLED === 'true', // Only enable if explicitly set
  enableSdk: process.env.LOG_SDK === 'true',
}

// SDK logger instance (will be set when available)
let sdkLogger: any = null

function parseDestinations(destinations: string): LogDestination[] {
  return destinations.split(',').map((d) => d.trim() as LogDestination)
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const currentLevelIndex = levels.indexOf(loggerConfig.level)
  const messageLevelIndex = levels.indexOf(level)
  return messageLevelIndex >= currentLevelIndex
}

function logToConsole(level: LogLevel, message: string, context?: LogContext) {
  if (
    !loggerConfig.enableConsole ||
    !loggerConfig.destinations.includes('console')
  ) {
    return
  }

  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`

  switch (level) {
    case 'debug':
      console.debug(prefix, message, context || '')
      break
    case 'info':
      console.info(prefix, message, context || '')
      break
    case 'warn':
      console.warn(prefix, message, context || '')
      break
    case 'error':
      console.error(prefix, message, context || '')
      break
  }
}

function logToSentry(level: LogLevel, message: string, context?: LogContext) {
  if (
    !loggerConfig.enableSentry ||
    !loggerConfig.destinations.includes('sentry')
  ) {
    return
  }

  // Map our log levels to Sentry severity levels
  const sentryLevel: 'debug' | 'info' | 'warning' | 'error' =
    level === 'debug'
      ? 'debug'
      : level === 'info'
        ? 'info'
        : level === 'warn'
          ? 'warning'
          : 'error'

  if (level === 'error') {
    Sentry.captureException(new Error(message), {
      extra: context,
      level: sentryLevel,
    })
  } else {
    Sentry.addBreadcrumb({
      message,
      level: sentryLevel,
      data: context,
      timestamp: Date.now() / 1000,
    })
  }
}

async function logToSdk(
  level: LogLevel,
  message: string,
  context?: LogContext
) {
  if (!loggerConfig.enableSdk || !loggerConfig.destinations.includes('sdk')) {
    return
  }

  try {
    // Use SDK logger if available (from query context)
    if (sdkLogger && typeof sdkLogger.log === 'function') {
      sdkLogger.log(level, message, context)
      return
    }

    // Fallback: Send to API endpoint if SDK logger not available
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        message,
        context,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    // Fallback to console if SDK logging fails
    console.warn('Failed to log to SDK:', error)
  }
}

// Main logging functions
function debug(message: string, context?: LogContext) {
  if (!shouldLog('debug')) return

  logToConsole('debug', message, context)
  logToSentry('debug', message, context)
  logToSdk('debug', message, context)
}

function info(message: string, context?: LogContext) {
  if (!shouldLog('info')) return

  logToConsole('info', message, context)
  logToSentry('info', message, context)
  logToSdk('info', message, context)
}

function warn(message: string, context?: LogContext) {
  if (!shouldLog('warn')) return

  logToConsole('warn', message, context)
  logToSentry('warn', message, context)
  logToSdk('warn', message, context)
}

function error(message: string, context?: LogContext) {
  if (!shouldLog('error')) return

  logToConsole('error', message, context)
  logToSentry('error', message, context)
  logToSdk('error', message, context)
}

// Security-specific logging
function security(
  event: string,
  details: LogContext,
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
  details: LogContext,
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

function setSdkLogger(logger: any) {
  sdkLogger = logger
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
  setSdkLogger,
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
  details: LogContext,
  level: LogLevel = 'warn'
) {
  logger.security(event, details, level)
}
