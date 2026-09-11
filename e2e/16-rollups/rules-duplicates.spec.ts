import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { rowActions, tour } from '../utils/selectors'

/**
 * Two rules can carry the same `propertyKey`, and one of them is yours.
 *
 * The node's uniqueness index is `(propertyKey, system, ownerUserId)`, so a user rule for `mass`
 * sits BESIDE the built-in `mass` rather than shadowing it — the create succeeds, no 409, and the
 * list comes back holding two entries with the same key. A table keyed on `propertyKey` breaks
 * there, which is why the duplicate is the case rather than the create.
 *
 * The client-side half is the opposite refusal: a key you ALREADY own never reaches the node at
 * all. That is a different message from the same-session queue guard RR3 covers, and the two are
 * easy to conflate.
 *
 * A rule is a RUNNING COST — computed for every entity of every user, against a node-wide cap — so
 * `afterAll` removes what this file created whether or not the tests passed.
 */

/**
 * A seeded system key that NO other spec types. `mass` was the obvious pick and it collides:
 * `rules.spec.ts` RR1 fills "Mass" and asserts the normalize hint, which the duplicate-key warning
 * replaces the moment this account owns a `mass` rule. A cleanup that slips then breaks a file this
 * one never touches.
 */
const SYSTEM_KEY = 'volume'

const rows = (page: Page) => page.getByTestId('data-table-row')

/**
 * Rows whose key is EXACTLY `SYSTEM_KEY`.
 *
 * `hasText` is a substring match, and the rollup specs name their own keys `mass${runId}` — so a
 * loose filter counts every rule a failed run left behind and the case reports a number that has
 * nothing to do with what it created.
 */
const keyRows = (page: Page, key: string) =>
  rows(page).filter({ has: page.getByText(key, { exact: true }) })

/**
 * The list mixes tiers, and only the "user" tier row is this file's to delete.
 *
 * `toPass` on the OUTCOME: a click landing before hydration does nothing, and an unfiltered list
 * still holds the built-in row under the same key — so the cleanup would target the system rule,
 * find no delete action, and leak the one it was written to remove.
 */
async function filterToUserRules(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-user').click()
    // `data-selected-state`, which `FilterMenu` mints itself — the row is a `CommandItem`, and
    // Radix does not give it a checked role.
    await expect(page.getByTestId('filter-option-user')).toHaveAttribute(
      'data-selected-state',
      'on',
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 30_000 })
  await page.keyboard.press('Escape')
}

/**
 * Remove this file's rule if it is there, and say nothing if it is not.
 *
 * Runs BEFORE the tests as well as after. A rule is account state that outlives the run, and a
 * leaked one is self-perpetuating: it makes `SYSTEM_KEY` a key the account already owns, which
 * disables Add, which fails RR5, which leaks again. Every later run then fails for a reason that
 * has nothing to do with what RR5 tests.
 */
async function removeUserRule(page: Page, key: string): Promise<void> {
  await page.goto('/rollup-rules')
  await expect(page.getByTestId('data-table').last()).toBeVisible()
  await filterToUserRules(page)

  const row = keyRows(page, key)

  // A SETTLE, not a bare `count()`. The list refetches when the tier filter lands, and reading the
  // count before it does returns 0 for a rule that is right there — the cleanup then returns
  // "nothing to do" and leaks it. That leak is self-perpetuating: it makes `SYSTEM_KEY` a key the
  // account owns, which disables Add, which fails RR5, which leaks again. A plain loop rather than
  // `toPass`, because what is being waited on is a fetch, not a flaky assertion.
  // Waits for a row that is actually DELETABLE, not merely for one carrying the key. The node
  // seeds a system rule under this same key, and a system rule has no actions menu at all — so a
  // poll on the key alone is satisfied by the seeded row the instant the tier filter has not
  // landed yet, and the click below then waits out the whole hook for a menu that never exists.
  const actions = rowActions(page, 'rollup-rule', row.first())
  let present = false
  for (let attempt = 0; attempt < 12; attempt++) {
    if ((await actions.menu.count()) > 0) {
      present = true
      break
    }
    await page.waitForTimeout(500)
  }
  if (!present) return

  await actions.menu.click()
  await actions.action('delete').click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^delete$/i })
    .click()
  await expect(row).toHaveCount(0, { timeout: 15_000 })
}

async function createRule(page: Page, key: string): Promise<void> {
  await tour(page, 'rollupRulesCreate').click()
  const field = page.getByTestId('rollup-rule-property-key')
  await expect(field).toBeVisible()
  await field.fill(key)

  // The hint under the input swaps as you type — normalized / duplicate / plain help, each a
  // different height — so the button below it REFLOWS, and Playwright's stability check fails the
  // click with "element is not stable" rather than anything about rules. Retrying on the OUTCOME
  // rides that out: enabled, clicked, and the key actually queued.
  const addKey = page.getByTestId('rollup-rule-add-key')
  await expect(addKey).toBeEnabled()
  await expect(async () => {
    await addKey.click()
    await expect(page.getByTestId('rollup-rule-queued-keys')).toContainText(
      key,
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 20_000 })

  await page.getByTestId('rollup-rule-submit').click()
}

test.describe('16 - rollups / duplicate keys', () => {
  test.describe.configure({ mode: 'serial' })

  // Both ends. `beforeAll` is not belt-and-braces — a run that died with the rule still on the
  // account makes the next one fail on a disabled Add button, and the screenshot shows a duplicate
  // warning rather than anything about duplicates being the subject.
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await removeUserRule(page, SYSTEM_KEY)
    await page.close()
  })

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await removeUserRule(page, SYSTEM_KEY)
    await page.close()
  })

  test('RR5: a user rule duplicates a built-in one rather than shadowing it', async ({
    page,
  }) => {
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()

    // `takenKeys` is built from your OWN rules, so a built-in key is not refused at the input —
    // proving the create is genuinely offered rather than merely tolerated.
    await createRule(page, SYSTEM_KEY)

    const matching = keyRows(page, SYSTEM_KEY)
    await expect(matching).toHaveCount(2, { timeout: 15_000 })

    // Two DISTINCT rules, not one row rendered twice. The table carries an id column and an owner
    // column, so the row text differs even though the key does not — and a list keyed on
    // `propertyKey` collapses exactly here.
    const text = await matching.evaluateAll((els) =>
      els.map((el) => el.textContent ?? '')
    )
    expect(new Set(text).size).toBe(2)
  })

  test('RR6: a key you already own is refused at the input, not at the node', async ({
    page,
  }) => {
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await tour(page, 'rollupRulesCreate').click()
    const field = page.getByTestId('rollup-rule-property-key')
    await expect(field).toBeVisible()
    await field.fill(SYSTEM_KEY)

    // RR3's guard is about the CURRENT queue and reads "already in the list". This one is about a
    // rule already saved on the account, and firing the wrong copy would send the user looking in
    // the wrong place.
    await expect(page.getByTestId('rollup-rule-duplicate-key')).toBeVisible()
    await expect(page.getByTestId('rollup-rule-already-queued')).toHaveCount(0)
    await expect(page.getByTestId('rollup-rule-add-key')).toBeDisabled()
  })
})
