import { expect, type Page } from '@playwright/test'

/**
 * Switch the list view, and do not return until a RELOAD still shows it.
 *
 * Two traps, both of which surface somewhere else entirely.
 *
 * A visible control is not a hydrated one — the page renders from the server and its buttons are
 * clickable while no handler is attached yet. Measured: a click right after `view-option-sankey`
 * became visible left `aria-pressed` false and issued no request at all. Nothing is logged; the
 * view selector simply looks broken. `toPass` re-clicks until the control reports the new state.
 *
 * And `aria-pressed` flips OPTIMISTICALLY, so returning on it hands back a page whose write is
 * still in flight. A caller that then closes the page — a restore in an `afterAll` is exactly that
 * — loses the write, and the next FILE opens on the view this one meant to put back. The reload is
 * what proves the account has it, rather than racing the PATCH response for it.
 */
export async function selectView(page: Page, value: string): Promise<void> {
  const option = page.getByTestId(`view-option-${value}`)
  await expect(option).toBeVisible()

  // NO already-there early return here, deliberately — `setLanguage` has one and it does not
  // transfer. That guard is safe on `/settings`, where a `toPass` tab activation has already proved
  // hydration. Here the whole point is that the control is clickable BEFORE hydration, and
  // `aria-pressed` at that moment comes from the first-paint cookie, which can disagree with the
  // account. Trusting it returned early without clicking, left `/processes` on the Sankey, and
  // reddened all twelve specs in the folder — a cascade, from a guard that saves one reload.

  await expect(async () => {
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true', {
      timeout: 3_000,
    })
  }).toPass({ timeout: 30_000 })

  await page.reload()
  await expect(page.getByTestId(`view-option-${value}`)).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15_000 }
  )
}
