import { expect, type Page } from '@playwright/test'

import { tour } from '../utils/selectors'

export const searchInput = (page: Page) =>
  page.getByTestId('command-center-input')

/** Below Tailwind's `md` the navbar shows a search icon in place of the search field. */
const MD_BREAKPOINT = 768

/** Opens the search box. Retried: the navbar button renders before it is hydrated. */
export async function openSearch(page: Page): Promise<void> {
  const narrow = (page.viewportSize()?.width ?? MD_BREAKPOINT) < MD_BREAKPOINT
  const button = narrow
    ? page.getByTestId('mobile-search')
    : tour(page, 'searchButton')
  await expect(async () => {
    await button.click()
    await expect(searchInput(page)).toBeFocused({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

/** Types a search and runs it with Enter, the way a user does. */
export async function runSearch(page: Page, query: string): Promise<void> {
  await openSearch(page)
  await searchInput(page).fill(query)
  await searchInput(page).press('Enter')
}

/** The object list request, not a single object (`/v1/objects/<id>`). */
export const OBJECT_LIST = /\/v1\/objects(\?|$)/

export const qOf = (url: string) => new URL(url).searchParams.get('q')

/**
 * One call to the node as the signed-in account. In the page, because only the page can mint the
 * short-lived core token (the same pattern as the seeds).
 */
export async function nodeCall<T = unknown>(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const result = await page.evaluate(
    async ({ method, path, body }) => {
      const config = (
        window as unknown as {
          __IOM_CONFIG__?: { authBaseUrl?: string; coreBaseUrl?: string }
        }
      ).__IOM_CONFIG__
      if (!config?.authBaseUrl || !config?.coreBaseUrl) {
        return { error: 'runtime config missing authBaseUrl/coreBaseUrl' }
      }
      const minted = await fetch(`${config.authBaseUrl}/api/auth/token`, {
        credentials: 'include',
      })
      if (!minted.ok) return { error: `token mint failed: ${minted.status}` }
      const { token } = (await minted.json()) as { token?: string }
      const res = await fetch(`${config.coreBaseUrl}/api/v1${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!res.ok) return { error: `${method} ${path} failed: ${res.status}` }
      return { data: res.status === 204 ? null : await res.json() }
    },
    { method, path, body }
  )
  if ('error' in result) throw new Error(String(result.error))
  return result.data as T
}

export async function createObject(
  page: Page,
  body: { name: string; properties?: unknown[] }
): Promise<string> {
  const created = await nodeCall<{ id: string }>(page, 'POST', '/objects', body)
  return created.id
}

export async function deleteObjects(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await nodeCall(page, 'DELETE', `/objects/${id}`)
}

/**
 * Removes this suite's saved searches: one `null` per key, never `{ search: {} }`, which would wipe
 * every saved search the account has.
 */
export async function sweepSavedSearches(
  page: Page,
  namePrefix: string
): Promise<void> {
  const me = await nodeCall<{
    preferences?: { search?: Record<string, { name?: string } | null> }
  }>(page, 'GET', '/me')
  const keys = Object.entries(me.preferences?.search ?? {})
    .filter(([, entry]) => entry?.name?.startsWith(namePrefix))
    .map(([key]) => key)
  if (keys.length === 0) return
  await nodeCall(page, 'PATCH', '/me/preferences', {
    search: Object.fromEntries(keys.map((key) => [key, null])),
  })
}

export const property = (key: string, data: string) => ({
  key,
  values: [{ data }],
})
