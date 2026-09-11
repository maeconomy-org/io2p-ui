'use client'

/**
 * Tour copy, loaded on demand.
 *
 * These strings used to live in the main catalogue, which meant ~5.5 KB of tour
 * text shipped to every client on every route so that a tour someone runs once
 * — or never — could read it. The tour components are already
 * `dynamic(…, { ssr: false })`; this gives their strings the same treatment.
 *
 * Deliberately keyed on WHEN a tour runs rather than WHICH route it runs on.
 * Onboarding is expected to grow to more pages, and a route-based split would
 * have to be unpicked the moment it did. Loading at launch stays correct however
 * far it spreads, because the cost is per tour start — a rare, explicit action —
 * not per page load.
 *
 * Only the tour namespace lives here. `common.next` / `common.previous` still
 * come from the normal provider, since `common` is needed app-wide anyway.
 */

export interface TourMessages {
  [group: string]: Record<string, string>
}

const cache = new Map<string, TourMessages>()

export async function loadTourMessages(locale: string): Promise<TourMessages> {
  const cached = cache.get(locale)
  if (cached) return cached

  // Falls back to English rather than throwing: a tour with untranslated copy
  // is a far better outcome than a tour that crashes the page it overlays.
  const messages: TourMessages = await import(
    `@/messages/onboarding/${locale}.json`
  )
    .then((m) => m.default)
    .catch(() => import('@/messages/onboarding/en.json').then((m) => m.default))

  cache.set(locale, messages)
  return messages
}

/** Read `group.key` out of a loaded bundle, falling back to the key itself. */
export function tourText(
  messages: TourMessages,
  group: string,
  key: string
): string {
  return messages[group]?.[key] ?? `${group}.${key}`
}
