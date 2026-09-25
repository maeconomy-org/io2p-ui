import { expect, type Page } from '@playwright/test'

/**
 * Open every rollup card on the page. At rest a card shows only its total, so a check on the split,
 * the counts or the other totals must open it first, or an absence check passes for the wrong reason.
 *
 * `waitForCard` when the test expects one: the totals load after the sheet, and opening "every card"
 * before the first arrives opens none.
 */
export async function openRollupCards(
  page: Page,
  { waitForCard = false }: { waitForCard?: boolean } = {}
): Promise<void> {
  const toggles = page.getByTestId('rollup-toggle')
  if (waitForCard) await expect(toggles.first()).toBeVisible()
  for (let i = 0; i < (await toggles.count()); i++) {
    const toggle = toggles.nth(i)
    if ((await toggle.getAttribute('aria-expanded')) === 'false')
      await toggle.click()
  }
}
