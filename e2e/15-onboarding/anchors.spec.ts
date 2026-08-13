import { expect, test } from '../fixtures/app'

/**
 * Every tour anchor a route is supposed to carry is actually IN THE DOM.
 *
 * `data-tour` is matched at runtime with `document.querySelector`. Going through `anchor()` and
 * `sel()` makes a RENAME a typecheck failure, but it cannot catch a DELETION: remove the element and
 * every call site still compiles, while the tour stalls on a step it can never reach. That is how
 * eight of the eleven demo steps came to point at elements the refactor had already removed
 * (`src/constants/tour-anchors.ts`).
 *
 * NOT covered by `__tests__/constants/tour-anchors.test.ts`, which asserts the same thing one layer
 * up: its `rendered()` greps the SOURCE for `anchor('x')` call sites, so it proves the code exists.
 * An anchor on a component behind an unmet condition, an early return or an unmounted branch passes
 * there and still fails the tour. This is the runtime half.
 *
 * It asserts the anchors, not the tours: driver.js mounting is covered — and currently `fixme`-d —
 * in `hints.spec.ts`.
 */

const anchor = (name: string) => `[data-tour="${name}"]`

test.describe('15 - onboarding / anchors', () => {
  test('ON1: the app shell carries its navigation anchors', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    for (const name of [
      'top-nav',
      'nav-objects',
      'nav-processes',
      'nav-shares',
      'nav-models',
      'nav-import',
      'search-button',
      'user-menu-trigger',
    ]) {
      await expect(
        page.locator(anchor(name)),
        `missing shell anchor: ${name}`
      ).toHaveCount(1)
    }
  })

  test('ON2: /objects carries every anchor its demo tour opens on', async ({
    page,
  }) => {
    // The first three steps of `create-object` run against the LIST, before the sheet exists.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    for (const name of ['filters', 'view-selector', 'create-object']) {
      await expect(
        page.locator(anchor(name)),
        `missing /objects anchor: ${name}`
      ).toHaveCount(1)
    }
  })

  test('ON3: the create sheet carries the anchors the tour walks through', async ({
    page,
  }) => {
    // Steps 4-10 of `create-object` all live inside the sheet, which is why a tour that only ever
    // ran on the list would not have noticed them going missing.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await page.locator(anchor('create-object')).click()
    await expect(page.getByTestId('entity-sheet')).toBeVisible()

    for (const name of [
      'sheet-template',
      'sheet-parents',
      'sheet-metadata',
      'sheet-address',
      'sheet-files',
      'sheet-properties',
      'sheet-submit',
    ]) {
      await expect(
        page.locator(anchor(name)),
        `missing create-sheet anchor: ${name}`
      ).toHaveCount(1)
    }
  })

  test('ON4: the library routes carry their create anchors', async ({
    page,
  }) => {
    for (const [route, name] of [
      ['/templates', 'templates-create'],
      ['/formulas', 'formulas-create'],
      ['/constants', 'constants-create'],
      // `/shares` is tabs rather than a bare table, so this waits on the anchor itself — asserting
      // presence and arrival in one step rather than guessing at a page-specific ready signal.
      ['/shares', 'shares-create'],
    ] as const) {
      await page.goto(route)
      await expect(
        page.locator(anchor(name)),
        `missing anchor ${name} on ${route}`
      ).toBeVisible()
    }
  })

  test('ON5: an anchor resolves to exactly ONE element', async ({ page }) => {
    // driver.js takes the FIRST match. Two elements sharing an anchor means the tour highlights
    // whichever the DOM happens to order first, which is not a choice anyone made.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    const duplicates = await page.evaluate(() => {
      const seen = new Map<string, number>()
      document.querySelectorAll('[data-tour]').forEach((el) => {
        const name = el.getAttribute('data-tour')!
        seen.set(name, (seen.get(name) ?? 0) + 1)
      })
      return [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name)
    })

    expect(duplicates).toEqual([])
  })
})
