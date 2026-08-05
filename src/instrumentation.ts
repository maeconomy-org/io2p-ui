// Server instrumentation: OTel only. Sentry is browser-only by design
// (observability plan §1.3/§1.4) — server errors flow via the logger's NDJSON
// stdout and the OTel log/span pipeline, so there is no sentry.server.config,
// no sentry.edge.config, and no onRequestError export here. Deleting the
// server-side Sentry init also removes the @sentry/nextjs-v10-owns-OTel
// interop problem instead of managing it.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOtel } = await import('./instrumentation.node')
    registerOtel()
  }
}
