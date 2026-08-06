// Server instrumentation: OTel only. Sentry is browser-only by design
// (observability plan §1.3/§1.4) — server errors flow via the logger's NDJSON
// stdout and the OTel log/span pipeline, so there is no sentry.server.config,
// no sentry.edge.config, and no Sentry-backed onRequestError here. Deleting
// the server-side Sentry init also removes the @sentry/nextjs-v10-owns-OTel
// interop problem instead of managing it.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOtel } = await import('./instrumentation.node')
    registerOtel()
  }
}

/**
 * Next calls this for uncaught errors in server components, route handlers
 * and server actions. Routing it through the logger puts those crashes into
 * NDJSON stdout and (when enabled) OTel — the surfaces the ops side actually
 * watches. No Sentry involved.
 *
 * The logger is imported lazily and only on the Node runtime: a static
 * import would drag the NDJSON sink (process.stdout) into the edge-analyzed
 * bundle and trip Turbopack's Edge Runtime warnings.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logger } = await import('@/lib/observability/logger')
  const digest = (err as { digest?: string } | null)?.digest
  logger.error('Unhandled server request error', {
    err,
    url: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    ...(digest ? { digest } : {}),
  })
}
