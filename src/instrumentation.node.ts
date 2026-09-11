// Server OTel boot: a manual NodeSDK, NOT @vercel/otel — that package exports
// traces only (no logs/metrics) and its sole unique advantage (edge runtime)
// is unused here (no middleware, no edge routes). Next 16 docs state a manual
// NodeSDK is equivalent; Next's built-in spans arrive automatically.
//
// Imported from instrumentation.ts register(), gated on NEXT_RUNTIME ===
// 'nodejs'. OTEL_ENABLED defaults to false → this module is a no-op and the
// app boots with zero OTel machinery. Telemetry must never break the app:
// a missing collector never fails a boot, exporter failures never throw.

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'

import type { LogLevel, LogRecord } from '@/lib/observability/logger/core'
import {
  FATAL_FLUSH,
  registerFatalHandlers,
} from '@/lib/observability/logger/fatal'
import { OTEL_LOG_SINK } from '@/lib/observability/logger/server'

// Local traffic that must not become tracing noise (plan §2 noise-drop list).
const IGNORED_PATHS = [
  '/api/health',
  '/api/config',
  '/api/telemetry',
  '/monitoring', // Sentry SDK tunnelRoute
]

const SEVERITY: Record<LogLevel, { num: SeverityNumber; text: string }> = {
  debug: { num: SeverityNumber.DEBUG, text: 'DEBUG' },
  info: { num: SeverityNumber.INFO, text: 'INFO' },
  warn: { num: SeverityNumber.WARN, text: 'WARN' },
  error: { num: SeverityNumber.ERROR, text: 'ERROR' },
}

const BOOTED = Symbol.for('io2p.otelBooted')

type GlobalWithOtel = typeof globalThis & {
  [BOOTED]?: boolean
  [OTEL_LOG_SINK]?: { write(rec: LogRecord): void }
  [FATAL_FLUSH]?: () => Promise<void>
}

function toLogAttributes(rec: LogRecord): Record<string, string | number> {
  const { level: _level, time: _time, msg: _msg, err, ...ctx } = rec
  const attributes: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(ctx)) {
    if (value === undefined || value === null) continue
    attributes[key] =
      typeof value === 'string' || typeof value === 'number'
        ? value
        : JSON.stringify(value)
  }
  if (err) {
    // OTel exception semconv keys, so backends group these natively.
    attributes['exception.type'] = err.name
    attributes['exception.message'] = err.message
    if (err.stack) attributes['exception.stacktrace'] = err.stack
    if (typeof err.status === 'number') {
      attributes['io2p.error.status'] = err.status
    }
  }
  return attributes
}

export function registerOtel(): void {
  // Process-level fatal handlers first, and UNCONDITIONALLY: a background
  // promise rejecting outside any request must reach NDJSON/OTel and crash
  // the process cleanly whether or not the OTel SDK is enabled.
  registerFatalHandlers()

  const g = globalThis as GlobalWithOtel
  if (g[BOOTED]) return
  if (process.env.OTEL_ENABLED !== 'true') return
  g[BOOTED] = true

  try {
    // Exporter/SDK internals report through diag; errors only, never throws.
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

    const resource = resourceFromAttributes({
      'service.name': 'io2p-ui',
      'service.version': process.env.APP_VERSION || 'unknown',
      'deployment.environment':
        process.env.DEPLOYMENT_ENVIRONMENT ||
        process.env.NODE_ENV ||
        'development',
      ...(process.env.SERVICE_NAMESPACE
        ? { 'service.namespace': process.env.SERVICE_NAMESPACE }
        : {}),
    })

    const sdk = new NodeSDK({
      resource,
      traceExporter: new OTLPTraceExporter(),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
        }),
      ],
      logRecordProcessors: [
        new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
      ],
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || ''
            return IGNORED_PATHS.some((p) => url.startsWith(p))
          },
        }),
        new RuntimeNodeInstrumentation(),
      ],
    })

    sdk.start()

    // Bridge the server logger into OTel logs: the NDJSON sink stays on
    // regardless; this adds the same records as OTel log records with trace
    // correlation. Handoff via globalThis because Next bundles
    // instrumentation.ts separately from route code.
    const otelLogger = logs.getLogger('io2p-ui')
    g[OTEL_LOG_SINK] = {
      write(rec: LogRecord): void {
        try {
          const severity = SEVERITY[rec.level] ?? SEVERITY.info
          const timeMs = Date.parse(rec.time)
          otelLogger.emit({
            severityNumber: severity.num,
            severityText: severity.text,
            body: rec.msg,
            timestamp: Number.isNaN(timeMs) ? Date.now() : timeMs,
            attributes: toLogAttributes(rec),
          })
        } catch {
          // Never let the bridge break a log call — NDJSON already has it.
        }
      },
    }

    // Hand the fatal handlers a flush: buffered spans/logs should leave the
    // process before a fatal exit(1).
    g[FATAL_FLUSH] = () => sdk.shutdown()

    // Best-effort flush on shutdown; never blocks or throws.
    const shutdown = () => {
      g[OTEL_LOG_SINK] = undefined
      g[FATAL_FLUSH] = undefined
      sdk.shutdown().catch(() => {})
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
  } catch {
    // OTel boot failure must never take the app down. NDJSON logging is
    // unaffected; there is nothing safe to report the failure to yet.
    g[OTEL_LOG_SINK] = undefined
    g[FATAL_FLUSH] = undefined
  }
}
