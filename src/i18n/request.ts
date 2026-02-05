import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import { routing } from './routing'

type Locale = (typeof routing.locales)[number]

const localeHeaderRegex = /^[a-z]{2}/i

function resolveHeaderLocale(headerValue: string | null): Locale | undefined {
  if (!headerValue) return undefined
  const candidate = headerValue.match(localeHeaderRegex)?.[0]?.toLowerCase()
  if (!candidate) return undefined
  return routing.locales.includes(candidate as Locale)
    ? (candidate as Locale)
    : undefined
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as
    | Locale
    | undefined
  const resolvedCookieLocale = cookieLocale
    ? routing.locales.includes(cookieLocale)
      ? cookieLocale
      : undefined
    : undefined
  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  const headerLocale = resolveHeaderLocale(acceptLanguage)
  const locale = resolvedCookieLocale || headerLocale || routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
