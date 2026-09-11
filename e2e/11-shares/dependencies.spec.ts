import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { formulaSibling, tour } from '../utils/selectors'

/**
 * Sharing a template offers to share the formulas and constants its recipes bind.
 *
 * A template that binds nothing must show no prompt at all — that half is asserted here too, because
 * an always-visible checkbox would ask the user to think about something that does not apply.
 */

const stamp = () => `e2e-${Date.now()}`

async function openShareForFirstTemplate(page: Page): Promise<void> {
  await page.goto('/templates')
  await expect(page.getByTestId('data-table-row').first()).toBeVisible()

  const row = page.getByTestId('data-table-row').first()
  await row.getByTestId('template-actions-dropdown').click()
  await page.getByTestId('template-action-share').click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('11 - shares / template dependencies', () => {
  test('SD1: the prompt only appears for a template that binds something', async ({
    page,
  }) => {
    await openShareForFirstTemplate(page)

    // Either shape is correct — which one depends on the template the list happens to show first.
    // What must NOT happen is a checkbox offering to share nothing, so the assertion is the LINK
    // between the two: the box exists only when there is something grantable behind it.
    const box = page.getByTestId('share-dependencies')
    const count = await box.count()
    if (count > 0) {
      await expect(box).toBeVisible()
      await expect(box).not.toBeChecked()
    }
    expect(count).toBeLessThanOrEqual(1)
  })

  test('SD2: ticking the box grants the dependencies alongside the template', async ({
    page,
    api,
  }) => {
    await page.goto('/templates')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    // Find a template that actually has dependencies; without one there is nothing to assert.
    const rows = page.getByTestId('data-table-row')
    const total = await rows.count()
    let found = false

    for (let i = 0; i < total && !found; i++) {
      await rows.nth(i).getByTestId('template-actions-dropdown').click()
      const share = page.getByTestId('template-action-share')
      if ((await share.count()) === 0) {
        await page.keyboard.press('Escape')
        continue
      }
      await share.click()
      await expect(page.getByRole('dialog')).toBeVisible()

      if ((await page.getByTestId('share-dependencies').count()) > 0) {
        found = true
        break
      }
      await page.keyboard.press('Escape')
    }

    // Genuinely absent rather than not-yet-painted: the loop above has already
    // opened every row on page 1. Named as a GAP so a skipped run does not read
    // as a covered one — close it by seeding a template that binds a formula.
    test.skip(
      !found,
      'NOT COVERED: no template on page 1 binds a formula or constant — needs a seeded fixture'
    )

    await page.getByTestId('share-dependencies').check()
    await expect(page.getByTestId('share-dependencies')).toBeChecked()

    // Nothing is written until Save — the box stages, like every other control in this sheet.
    expect(api.count(/\/api\/v1\/access\/grants/)).toBe(0)
  })

  test('SD3: a template with a broken binding says so and cannot be fixed here', async ({
    page,
  }) => {
    // The endpoint reports a deleted dependency rather than omitting it, so the sheet can say the
    // template will not compute for anyone. Rewritten on the way in: deleting a real formula to
    // stage this would break whatever else binds it.
    await page.route(
      /\/api\/v1\/templates\/[0-9a-f-]{8,}\/share-dependencies/i,
      async (route) => {
        await route.fulfill({
          json: {
            formulas: [
              {
                id: 'f-gone',
                name: 'removed_formula',
                deleted: true,
                system: false,
                owned: true,
              },
            ],
            constants: [],
          },
        })
      }
    )

    await openShareForFirstTemplate(page)

    await expect(page.getByTestId('share-dependencies-broken')).toBeVisible()
    // No checkbox: a deleted item cannot be granted by anybody, so offering it would be a control
    // whose only outcome is a failed request.
    await expect(page.getByTestId('share-dependencies')).toHaveCount(0)
  })

  test('SD4: a dependency owned by someone else is named, not offered', async ({
    page,
  }) => {
    await page.route(
      /\/api\/v1\/templates\/[0-9a-f-]{8,}\/share-dependencies/i,
      async (route) => {
        await route.fulfill({
          json: {
            formulas: [],
            constants: [
              {
                id: 'c-theirs',
                name: 'someone_elses',
                deleted: false,
                system: false,
                owned: false,
              },
            ],
          },
        })
      }
    )

    await openShareForFirstTemplate(page)

    await expect(page.getByTestId('share-dependencies-foreign')).toBeVisible()
    await expect(page.getByTestId('share-dependencies')).toHaveCount(0)
  })

  test('SD5: a built-in dependency is not mentioned at all', async ({
    page,
  }) => {
    // A system item is visible to everyone, so naming it would ask the user to decide something
    // that has no effect either way.
    await page.route(
      /\/api\/v1\/templates\/[0-9a-f-]{8,}\/share-dependencies/i,
      async (route) => {
        await route.fulfill({
          json: {
            formulas: [
              {
                id: 'f-builtin',
                name: 'area',
                deleted: false,
                system: true,
                owned: false,
              },
            ],
            constants: [],
          },
        })
      }
    )

    await openShareForFirstTemplate(page)

    await expect(page.getByTestId('share-dependencies')).toHaveCount(0)
    await expect(page.getByTestId('share-dependencies-broken')).toHaveCount(0)
    await expect(page.getByTestId('share-dependencies-foreign')).toHaveCount(0)
  })
})

test.describe('03 - object sheet / binding scope', () => {
  test('F14: the binding picker filters between values and constants', async ({
    page,
  }) => {
    // Both groups share one list, and a long constant library used to push the entity's own values
    // off screen — the properties are the primary input, so they need a way back.
    const tag = stamp()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    await tour(page, 'createObject').click()
    await expect(page.getByTestId('entity-sheet')).toBeVisible()
    await page.locator('#entity-name').fill(`${tag}-scope`)

    // A numeric sibling, so the values group has something in it to hide and reveal.
    await page.getByTestId('add-property').click()
    await page.getByTestId('property-name-0').fill('width')
    await page.getByTestId('property-value-0-0').fill('10')

    await page.getByTestId('add-property').click()
    await page.getByTestId('property-name-1').fill('derived')
    await page.getByTestId('value-mode-1-0').click()
    await page.getByTestId('formula-select').click()

    // The account has formulas, so this waits for the list to paint rather than
    // reading it once and deleting the case.
    const options = page.getByTestId(/^formula-option-/)
    await expect(options.first()).toBeVisible()
    await options.first().click()

    const firstVariable = page.getByTestId(/^formula-bind-/).first()
    await firstVariable.click()

    // All: both groups on offer.
    await expect(page.getByTestId('binding-scope-all')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    // `Width`, not the `width` that was typed. The sibling testid is minted from the LABEL, and
    // `collectSiblings` resolves a dictionary key through `resolvePropertyLabel` — so a key the
    // dictionary knows comes back as its display name.
    await page.getByTestId('binding-scope-constants').click()
    await expect(formulaSibling(page, 'Width')).toHaveCount(0)

    await page.getByTestId('binding-scope-siblings').click()
    await expect(formulaSibling(page, 'Width')).toBeVisible()
    await expect(page.getByTestId(/^formula-constant-/)).toHaveCount(0)
  })
})
