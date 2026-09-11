import { collectConsoleErrors, expect, test } from '../fixtures/app'
import { AUTH_STATE } from '../setup/credentials'
import { createObjectWithId, createProcess } from '../utils/process'

const stamp = () => `e2e-${Date.now()}`

test.describe('07 - processes / related filter', () => {
  test('PR16/PR17: ?ref= narrows the list to the processes that use the object', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const processName = `${tag}-proc`

    const inputId = await createObjectWithId(page, inputName)
    await createProcess(page, processName, [inputName], inputName)

    await page.goto(`/processes?ref=${inputId}`)

    // Wait for ONE bar before asserting it is visible. A client transition keeps the outgoing page
    // hidden — Playwright's strict mode then fails on the ambiguity rather than on the app.
    await expect(page.getByTestId('related-object-bar')).toHaveCount(1)
    await expect(page.getByTestId('related-object-bar')).toBeVisible()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: processName })
    ).toHaveCount(1)

    await page.getByTestId('related-object-clear').click()
    await expect(page.getByTestId('related-object-bar')).toBeHidden()
    await expect(page).not.toHaveURL(/ref=/)
  })

  test('PR18: the related bar and the selection bar stack without overlapping', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const processName = `${tag}-proc`

    const inputId = await createObjectWithId(page, inputName)
    await createProcess(page, processName, [inputName], inputName)

    await page.goto(`/processes?ref=${inputId}`)
    const related = page.getByTestId('related-object-bar')
    // ONE `toPass`, not two assertions: a client transition keeps the outgoing page mounted, so the
    // count can settle to 1 and go back to 2 between two separate awaits.
    await expect(async () => {
      await expect(related).toHaveCount(1, { timeout: 3_000 })
      await expect(related).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    // The SELECTION bar as the second one, not search: search is rate-limited on the node, and
    // four parallel workers across repeated runs get a 429. A checkbox needs no network.
    await page
      .getByTestId('data-table-row')
      .filter({ hasText: processName })
      .getByRole('checkbox')
      .check()

    const selection = page.getByTestId('bulk-bar')
    await expect(selection).toBeVisible()

    const a = await related.boundingBox()
    const b = await selection.boundingBox()
    const disjoint =
      a && b && (a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1)
    expect(disjoint, 'the two floating bars overlap').toBe(true)
  })

  /**
   * N8 — the same deep link as the FIRST navigation of a tab that has never rendered the app.
   *
   * PR16/PR17 reach `?ref=` from a page that already created the object, so the filter is applied
   * by a router that is already mounted. This one is a cold document: the param has to be read on
   * mount, and the bar's own `useGet` has to resolve the NAME from nothing. `related-object-bar`
   * falls back to `data?.name ?? objectId`, so a resolve that never fires leaves a raw UUID on
   * screen and every warm-cache case still passes — which is why the name is asserted here and
   * nowhere else.
   *
   * Its own context, not `page.goto`: the `consoleGuard` fixture watches the fixture's page, and a
   * hydration mismatch is the failure this case is named after. So the cold tab attaches the
   * fixture's own collector to its own page.
   */
  test('N8: ?ref= in a cold tab resolves the name and hydrates cleanly', async ({
    page,
    browser,
  }, testInfo) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const processName = `${tag}-proc`

    const inputId = await createObjectWithId(page, inputName)
    await createProcess(page, processName, [inputName], inputName)

    const { baseURL, viewport, ignoreHTTPSErrors } = testInfo.project.use
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      baseURL,
      viewport,
      ignoreHTTPSErrors,
    })
    try {
      const cold = await context.newPage()
      // The FIXTURE's collector, not a second copy: a hand-rolled pair of listeners drops
      // `IGNORED_CONSOLE` — and a cold context loading a route for the first time is the likeliest
      // place in the suite to hit the chunk request that filter exists for.
      const errors = collectConsoleErrors(cold)

      await cold.goto(`/processes?ref=${inputId}`)

      const bar = cold.getByTestId('related-object-bar')
      await expect(bar).toBeVisible()
      // The NAME, positively — this is the half a warm tab cannot fail.
      await expect(bar).toContainText(inputName)
      // And not the id it falls back to. Without this the case passes on a bar that resolved
      // nothing, since the fallback string is itself visible text.
      await expect(bar).not.toContainText(inputId)

      await expect(
        cold.getByTestId('data-table-row').filter({ hasText: processName })
      ).toHaveCount(1)

      expect(errors, 'console errors in the cold tab').toEqual([])
    } finally {
      await context.close()
    }
  })
})
