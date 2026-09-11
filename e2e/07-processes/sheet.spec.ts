import { expect, test } from '../fixtures/app'
import {
  createObjectWithId,
  createProcess,
  openProcess,
} from '../utils/process'
import {
  addProperty,
  enterEditMode,
  fillProperty,
  saveSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * PR5 — the process sheet is ONE entity behind four tabs, and a save from one of them keeps the
 * other three.
 *
 * `flows.spec.ts` covers inputs and outputs, and covers them well; nothing covered a process's own
 * PROPERTIES or FILES, and nothing at all covered the seam between the tabs. That seam is the case.
 *
 * The save is a DIFF, not the whole draft — measured: editing Details sends
 * `PATCH /api/v1/processes/<id>` carrying `properties,files` and nothing else, so the two bags this
 * test never opened are absent from the payload and the node leaves them alone. The flow assertions
 * pin that scoping. A client that regressed to submitting the full aggregate would send the bags it
 * did render, and the node refuses an empty `inputs` (PR12) — so the failure would arrive as a save
 * that silently does not close the sheet, which is exactly what the inversion produced.
 *
 * A REFERENCE rather than an upload for the file half: `05-uploads` owns the presigned PUT, and a
 * reference travels in the entity body, which is the half this case is about.
 */

const stamp = () => `e2e-${Date.now()}`

test.describe('07 - processes / sheet', () => {
  test('PR5: properties and files save from Details without losing the flows', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const name = `${tag}-pr5`
    const propName = `${tag}-prop`

    await createObjectWithId(page, inputName)
    await createProcess(page, name, [inputName], inputName)

    await openProcess(page, name)
    await enterEditMode(page)

    const index = await addProperty(page, 0)
    await fillProperty(page, index, propName, '42')

    await switchTab(page, 'files')
    await page.getByTestId('add-files').click()
    await expect(page.getByTestId('attachment-modal')).toBeVisible()
    await page
      .getByTestId('attachment-modal-url')
      .fill('https://example.org/pr5.pdf')
    await page.getByTestId('attachment-modal-label').fill(`${tag}-ref`)
    await page.getByTestId('attachment-modal-add-reference').click()
    await page.getByTestId('attachment-modal-done').click()

    await saveSheet(page)

    // A RELOAD, not just a reopen. The sheet keeps its own draft in memory, so reading it back
    // without dropping the document proves the form remembers, not that the node stored anything.
    await page.reload()
    await openProcess(page, name)

    // READ mode, which is where the sheet reopens — the name and the value are text here, not
    // inputs, and that is what the user is shown. Asserting the edit form instead would read back
    // the draft the form seeded rather than the row the sheet renders.
    await switchTab(page, 'details')
    // The read view renders each property as a Collapsible trigger and carries no testid, so the
    // row is addressed by its own label. Scoped to that row rather than to the sheet: `42` as a
    // bare substring of the whole panel also matches a digit pair inside the UUID.
    const property = sheet(page)
      .getByRole('button')
      .filter({ hasText: propName })
    await expect(property).toHaveCount(1)
    await expect(property).toContainText('42')

    await switchTab(page, 'files')
    await expect(
      page.getByTestId('file-row').filter({ hasText: `${tag}-ref` })
    ).toHaveCount(1)

    // The flows the save never touched. NOT where the inversion landed: forcing `inputs: []` into
    // the payload produces a refusal, and `saveSheet` fails on the sheet that never closes, well
    // before this line. These two cover the case that gets PAST the node — an accepted write that
    // empties a bag the user never opened — which is the one nothing upstream would catch.
    await switchTab(page, 'inputs')
    await expect(page.getByTestId('flow-row-inputs-0')).toBeVisible()
    await switchTab(page, 'outputs')
    await expect(page.getByTestId('flow-row-outputs-0')).toBeVisible()
  })
})
