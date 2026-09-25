import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'nl'],
  defaultLocale: 'en',
  localePrefix: 'never',
})

/**
 * Shared by the server request config and the client provider — they must agree, or a date renders
 * one way on the server and another in the browser and React reports a hydration mismatch.
 */
export const DEFAULT_TIME_ZONE = 'UTC'
