import { collectConsoleErrors, expect, test } from '../fixtures/app'
import { AUTH_STATE } from '../setup/credentials'
import { createObjectWithId, createProcess } from '../utils/process'
import { selectView } from '../utils/views'

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

    // Wait for ONE chip before asserting it is visible. A client transition keeps the outgoing page
    // hidden — Playwright's strict mode then fails on the ambiguity rather than on the app.
    await expect(page.getByTestId('related-object-chip')).toHaveCount(1)
    await expect(page.getByTestId('related-object-chip')).toBeVisible()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: processName })
    ).toHaveCount(1)

    await page.getByTestId('related-object-clear').click()
    await expect(page.getByTestId('related-object-chip')).toBeHidden()
    await expect(page).not.toHaveURL(/ref=/)
  })

  test('PR18: with ?ref= and a selection, the selection bar is the only floating bar', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const processName = `${tag}-proc`

    const inputId = await createObjectWithId(page, inputName)
    await createProcess(page, processName, [inputName], inputName)

    await page.goto(`/processes?ref=${inputId}`)
    // ONE `toPass`, not two assertions: a client transition keeps the outgoing page mounted, so the
    // count can settle to 1 and go back to 2 between two separate awaits.
    const chip = page.getByTestId('related-object-chip')
    await expect(async () => {
      await expect(chip).toHaveCount(1, { timeout: 3_000 })
      await expect(chip).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    await page
      .getByTestId('data-table-row')
      .filter({ hasText: processName })
      .getByRole('checkbox')
      .check()

    await expect(page.getByTestId('bulk-bar')).toBeVisible()
    await expect(page.locator('[role="region"].fixed')).toHaveCount(1)
    await expect(chip).toBeVisible()
  })

  test('PR19: in the chart view the ?ref= object is ticked in the object filter, and unticking it clears the param', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const processName = `${tag}-proc`

    const inputId = await createObjectWithId(page, inputName)
    await createProcess(page, processName, [inputName], inputName)

    await page.goto('/processes')
    await selectView(page, 'sankey')
    try {
      await page.goto(`/processes?ref=${inputId}`)
      await expect(page.getByTestId('related-object-chip')).toHaveCount(0)

      await page.getByTestId('flow-object-filter').click()
      const option = page
        .getByTestId('flow-object-option')
        .filter({ hasText: inputName })
      await expect(option).toHaveAttribute('data-checked', 'true')

      await option.click()
      await expect(page).not.toHaveURL(/ref=/)
      await expect(option).toHaveAttribute('data-checked', 'false')
    } finally {
      await selectView(page, 'table')
    }
  })

  test('PR21: a bare ?ref= is ignored rather than sent as an empty filter', async ({
    page,
    api,
  }) => {
    await page.goto('/processes?ref=')

    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await expect(page.getByTestId('related-object-chip')).toHaveCount(0)
    expect(api.count(/\/v1\/processes\?/)).toBeGreaterThan(0)
    expect(api.count(/\/v1\/processes\?(.*&)?ref=(&|$)/)).toBe(0)
  })

  /**
   * N8 — the same deep link as the FIRST navigation of a tab that has never rendered the app.
   *
   * PR16/PR17 reach `?ref=` from a page that already created the object, so the filter is applied
   * by a router that is already mounted. This one is a cold document: the param has to be read on
   * mount, and the chip's own `useGet` has to resolve the NAME from nothing. `related-object-chip`
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

      const chip = cold.getByTestId('related-object-chip')
      await expect(chip).toBeVisible()
      // The NAME, positively — this is the half a warm tab cannot fail.
      await expect(chip).toContainText(inputName)
      // And not the id it falls back to. Without this the case passes on a chip that resolved
      // nothing, since the fallback string is itself visible text.
      await expect(chip).not.toContainText(inputId)

      await expect(
        cold.getByTestId('data-table-row').filter({ hasText: processName })
      ).toHaveCount(1)

      expect(errors, 'console errors in the cold tab').toEqual([])
    } finally {
      await context.close()
    }
  })
})
