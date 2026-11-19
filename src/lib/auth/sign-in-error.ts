/**
 * The message key for a failed email or social sign-in.
 *
 * Decided by status and code, never by the message text: the issuer's i18n
 * plugin translates `message`, so Dutch users got text no English word match
 * could recognise, and a gateway 503 has no message at all.
 */
export const SIGN_IN_ERROR_KEYS = [
  'auth.errors.invalidCredentials',
  'auth.errors.banned',
  'common.tooManyRequests',
  'auth.errors.unavailable',
  'auth.errors.authFailed',
] as const

export type SignInErrorKey = (typeof SIGN_IN_ERROR_KEYS)[number]

/** What a certificate sign-in can show; decided in auth-context's `handleAuth`. */
export const CERTIFICATE_ERROR_KEYS = [
  'auth.errors.authFailed',
  'auth.errors.certificateFailed',
] as const

export type CertificateErrorKey = (typeof CERTIFICATE_ERROR_KEYS)[number]

/** The better-auth client's error: always a status, a code only when the issuer answered. */
export interface SignInError {
  status?: number
  code?: string
}

/** `undefined` stands for a request that never got an answer (offline, refused, timed out). */
export function signInErrorKey(error: SignInError | undefined): SignInErrorKey {
  if (error?.code === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'auth.errors.invalidCredentials'
  }
  if (error?.code === 'BANNED_USER') {
    return 'auth.errors.banned'
  }
  // better-auth's limiter sends no code, only the status.
  if (error?.status === 429) {
    return 'common.tooManyRequests'
  }
  if (!error?.status || error.status >= 500) {
    return 'auth.errors.unavailable'
  }
  return 'auth.errors.authFailed'
}
