import { expect, type Page } from '@playwright/test'

import { tour } from '../utils/selectors'

export const searchInput = (page: Page) =>
  page.getByTestId('command-center-input')

/** Opens the search box. Retried: the navbar button renders before it is hydrated. */
export async function openSearch(page: Page): Promise<void> {
  await expect(async () => {
    await tour(page, 'searchButton').click()
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
