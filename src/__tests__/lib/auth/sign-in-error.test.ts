import { describe, it, expect } from 'vitest'

import { signInErrorKey } from '@/lib/auth/sign-in-error'

describe('signInErrorKey', () => {
  it.each([
    [
      'a wrong password, in Dutch',
      {
        status: 401,
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Ongeldig e-mailadres of wachtwoord',
      },
      'auth.errors.invalidCredentials',
    ],
    [
      'a blocked account',
      { status: 403, code: 'BANNED_USER' },
      'auth.errors.banned',
    ],
    [
      'the rate limiter, which sends no code',
      { status: 429, message: 'Too many requests. Please try again later.' },
      'common.tooManyRequests',
    ],
    [
      'a gateway 503 with no body',
      { status: 503, statusText: 'Service Unavailable' },
      'auth.errors.unavailable',
    ],
    [
      'an issuer 500',
      { status: 500, code: 'INTERNAL' },
      'auth.errors.unavailable',
    ],
    ['no answer at all', undefined, 'auth.errors.unavailable'],
    ['a status of 0', { status: 0 }, 'auth.errors.unavailable'],
    [
      'a wrong TRUSTED_ORIGINS',
      { status: 403, code: 'INVALID_ORIGIN' },
      'auth.errors.authFailed',
    ],
  ])('%s', (_name, error, key) => {
    expect(signInErrorKey(error)).toBe(key)
  })
})
