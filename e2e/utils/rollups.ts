import type { Page } from '@playwright/test'

/**
 * Open every rollup card on the page. At rest a card shows only its total, so a check on the split,
 * the counts or the other totals must open it first, or an absence check passes for the wrong reason.
 */
export async function openRollupCards(page: Page): Promise<void> {
  const toggles = page.getByTestId('rollup-toggle')
  for (let i = 0; i < (await toggles.count()); i++) {
    const toggle = toggles.nth(i)
    if ((await toggle.getAttribute('aria-expanded')) === 'false')
      await toggle.click()
  }
}
