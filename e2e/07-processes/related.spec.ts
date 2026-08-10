import { expect, test } from '../fixtures/app'
import { createObjectWithId, createProcess } from '../utils/process'

/**
 * §6.11 PR16-PR18 — the `?ref=` filter.
 *
 * A `write` spec, and it has to be. The first version lived in the read file and filtered by an
 * arbitrary object id taken from the list. That object was an input to no process, so the filtered
 * table held ZERO rows — the bar appeared, which is all the spec checked, while the case it meant
 * to make was never exercised. Seeding a process with a known input is the only way the filter can
 * be asserted to select something rather than merely to render.
 */

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

    // PR16: the bar names the object AND the table holds the process that uses it. The row is the
    // half that matters — a bar over an empty table looks identical to a working filter.
    await expect(page.getByTestId('related-object-bar')).toBeVisible()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: processName })
    ).toHaveCount(1)

    // PR17: clearing drops the bar, the param and the filter together.
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
    await expect(related).toBeVisible()

    // The SELECTION bar as the second one, not search: search is rate-limited on the node, and
    // four parallel workers across repeated runs get a 429. A checkbox needs no network.
    await page
      .getByTestId('data-table-row')
      .filter({ hasText: processName })
      .getByRole('checkbox')
      .check()

    const selection = page.getByTestId('bulk-bar')
    await expect(selection).toBeVisible()

    // `FLOATING_BAR_LEVELS` exists so two bars never sit on top of each other. Comparing the boxes
    // is the only way to see it: both report "visible" whether they overlap or not.
    const a = await related.boundingBox()
    const b = await selection.boundingBox()
    const disjoint =
      a && b && (a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1)
    expect(disjoint, 'the two floating bars overlap').toBe(true)
  })
})
