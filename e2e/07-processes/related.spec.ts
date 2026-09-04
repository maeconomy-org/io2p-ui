import { expect, test } from '../fixtures/app'
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
})
