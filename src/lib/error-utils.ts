/**
 * Utility to detect permission (403 Forbidden) errors from the backend.
 *
 * The SDK may throw errors in different shapes. This helper checks
 * common patterns: { status: 403 }, { detail: "Missing permission: ..." },
 * or a message containing "Forbidden" / "Missing permission".
 */
export function isForbiddenError(error: unknown): boolean {
  if (!error) return false

  // Check for status property
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    if (err.status === 403) return true
    if (err.statusCode === 403) return true

    // Check nested response
    if (
      typeof err.response === 'object' &&
      err.response !== null &&
      (err.response as Record<string, unknown>).status === 403
    ) {
      return true
    }

    // Check body
    if (
      typeof err.body === 'object' &&
      err.body !== null &&
      (err.body as Record<string, unknown>).status === 403
    ) {
      return true
    }
  }

  // Check message string
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error)

  return (
    message.includes('Forbidden') ||
    message.includes('Missing permission') ||
    message.includes('403')
  )
}

/**
 * Extract a user-friendly detail from a permission error, if available.
 */
export function getErrorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const err = error as Record<string, unknown>

  if (typeof err.detail === 'string') return err.detail

  if (
    typeof err.body === 'object' &&
    err.body !== null &&
    typeof (err.body as Record<string, unknown>).detail === 'string'
  ) {
    return (err.body as Record<string, unknown>).detail as string
  }

  return undefined
}
