import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import {
  PREF_COOKIE_NAME,
  decodePreferenceCookie,
} from '@/constants/preference-cookie'

import { DEFAULT_TIME_ZONE, routing } from './routing'

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
  // The account's locale, mirrored into the preference cookie. `NEXT_LOCALE` is
  // the pre-migration home and stays readable so an existing user does not get
  // reset to English once before `/me` seeds the new cookie.
  const storedLocale = decodePreferenceCookie(
    cookieStore.get(PREF_COOKIE_NAME)?.value
  ).locale
  const legacyLocale = cookieStore.get('NEXT_LOCALE')?.value as
    | Locale
    | undefined
  const resolvedCookieLocale =
    storedLocale ??
    (legacyLocale && routing.locales.includes(legacyLocale)
      ? legacyLocale
      : undefined)
  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  const headerLocale = resolveHeaderLocale(acceptLanguage)
  const locale = resolvedCookieLocale || headerLocale || routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    /**
     * The server has no way to know the reader's zone, so without a default it falls back to the
     * machine's — which differs between the server render and the browser, producing a hydration
     * mismatch on any formatted date. UTC is the honest choice for timestamps the server minted;
     * it's the same instant everywhere, and it renders identically on both sides.
     */
    timeZone: DEFAULT_TIME_ZONE,
  }
})
