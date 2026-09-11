import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import {
  addProperty,
  expandProperty,
  fillProperty,
  saveSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * One list holds object AND process templates, which is why the create button asks which kind and
 * why the type filter exists at all.
 */

const stamp = () => `e2e-${Date.now()}`

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function openCreate(page: Page, kind: 'object' | 'process') {
  await page.goto('/templates')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'templatesCreate').click()
  await page
    .getByRole('menuitem', { name: kind === 'object' ? /object/i : /process/i })
    .click()
  await expect(sheet(page)).toBeVisible()
}

/**
 * Open a template in edit mode and wait for its own values to arrive. The sheet renders before the
 * fetch resolves and `form.reset` then overwrites whatever was typed in between — so typing early
 * looks like it worked and saves nothing.
 */
async function openForEdit(page: Page, name: string) {
  await rowFor(page, name).getByTestId('template-actions-dropdown').click()
  await page.getByTestId('template-action-edit').click()
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page).getByLabel(/name/i).first()).toHaveValue(name)
}

async function filterBy(page: Page, option: string) {
  await page.getByTestId('filter-menu').click()
  await page.getByTestId(`filter-option-${option}`).click()
  await page.keyboard.press('Escape')
}

test.describe('08 - templates', () => {
  test('TP1: an object template is created with its properties', async ({
    page,
  }) => {
    const name = `${stamp()}-tp1`
    await openCreate(page, 'object')

    await sheet(page).getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Material', 'concrete')
    await addProperty(page, 1)
    await fillProperty(page, 1, 'Thickness', '200')

    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await expect(rowFor(page, name)).toHaveCount(1)
  })

  test('TP2: a process template is created with flows on both sides', async ({
    page,
  }) => {
    const name = `${stamp()}-tp2`
    await openCreate(page, 'process')

    await sheet(page).getByLabel(/name/i).first().fill(name)
    // A process template starts with one slot per side, and its refs are OPTIONAL — the template
    // scaffolds the shape, the object it applies to supplies the targets.
    await expect(page.getByTestId('flow-row-inputs-0')).toBeVisible()
    await expect(page.getByTestId('flow-row-outputs-0')).toBeVisible()

    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await expect(rowFor(page, name)).toHaveCount(1)
  })

  test('TP3: the type filter splits object from process templates', async ({
    page,
    api,
  }) => {
    await page.goto('/templates')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await filterBy(page, 'process')
    await expect.poll(() => api.count(/type=process/)).toBeGreaterThan(0)

    // Asserted on the REQUEST: whether any process template happens to exist is seed data, and a
    // filter over zero rows renders exactly like a filter that was never applied.
    await filterBy(page, 'object')
    await expect.poll(() => api.count(/type=object/)).toBeGreaterThan(0)
  })

  test('TP4: the owner filter separates built-in from user-created', async ({
    page,
    api,
  }) => {
    await page.goto('/templates')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await filterBy(page, 'system')
    await expect.poll(() => api.count(/system=true/)).toBeGreaterThan(0)

    await filterBy(page, 'user')
    await expect.poll(() => api.count(/system=false/)).toBeGreaterThan(0)
  })

  test('TP9: a template owned by someone else offers no Edit anywhere', async ({
    page,
  }) => {
    // The owner is rewritten on the way in. A template is shared READ-ONLY, so the only way to see
    // one you cannot write is for another account to own it — and this account cannot create a
    // template it does not own. Same justification as the F7 provenance mock.
    const foreign = 'someone-else'
    const reown = async (payload: Record<string, unknown>) =>
      Array.isArray(payload.data)
        ? {
            ...payload,
            data: payload.data.map((item) => ({
              ...(item as object),
              ownerUserId: foreign,
            })),
          }
        : { ...payload, ownerUserId: foreign }

    // RegExp, not a glob: Playwright reads `?` in a URL glob as a one-character wildcard, so
    // `templates?**` also matches `templates/<id>`.
    for (const pattern of [
      /\/api\/v1\/templates(\?|$)/,
      /\/api\/v1\/templates\/[0-9a-f-]{8,}/i,
    ]) {
      await page.route(pattern, async (route) => {
        const response = await route.fetch()
        await route.fulfill({
          response,
          json: await reown(await response.json()),
        })
      })
    }

    await page.goto('/templates')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    const row = page.getByTestId('data-table-row').first()
    await row.getByTestId('template-actions-dropdown').click()
    await expect(page.getByTestId('template-action-edit')).toHaveCount(0)
    await expect(page.getByTestId('template-action-delete')).toHaveCount(0)
    await page.keyboard.press('Escape')

    // The SHEET is the half that was broken: its footer rendered Edit for every entity, so the
    // read-only path was one click from a 403 on save.
    await row.getByTestId('template-details-button').click()
    await expect(sheet(page)).toBeVisible()
    await expect(page.getByTestId('sheet-read-only')).toBeVisible()
    await expect(page.getByTestId('sheet-edit')).toHaveCount(0)
    await expect(page.getByTestId('sheet-delete')).toHaveCount(0)
  })

  test('TP5: metadata edits save, an empty name blocks, and delete confirms', async ({
    page,
  }) => {
    const name = `${stamp()}-tp5`
    await openCreate(page, 'object')
    await sheet(page).getByLabel(/name/i).first().fill(name)
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await openForEdit(page, name)

    // A blank name is refused at SUBMIT with a message, not by grey-ing the button — the sheet
    // stays open holding the work rather than leaving a dead control to puzzle over.
    const nameField = sheet(page).getByLabel(/name/i).first()
    await nameField.fill('   ')
    await saveSheet(page, { expectClose: false })
    await expect(sheet(page)).toBeVisible()
    await expect(
      page.locator('[data-sonner-toaster] li').filter({ hasText: /name/i })
    ).toBeVisible()

    const renamed = `${name}-renamed`
    await nameField.fill(renamed)
    await saveSheet(page)
    await page.goto('/templates')
    await expect(rowFor(page, renamed)).toHaveCount(1)

    await rowFor(page, renamed).getByTestId('template-actions-dropdown').click()
    await page.getByTestId('template-action-delete').click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(renamed)
    await dialog.getByRole('button', { name: /delete/i }).click()

    await expect(rowFor(page, renamed)).toHaveCount(0)
  })

  /**
   * The refusal is the UI compensating for its OWN builder: `template.ts:204`
   * and `:235` filter a nameless property out of the payload, so saving would
   * drop the value in silence. The handler `return`s before any request — no
   * node rule is involved, and `PropertyInputShape.key` would accept an empty
   * string.
   *
   * The RECOVERY half is the one that matters. This sheet shipped with no guard
   * at all, and the two sheets that had one shipped refusing PERMANENTLY, so a
   * test that stopped at the rejection would have been green over both defects.
   */
  test('TP14: a template property with a value but no name blocks, then saves once named', async ({
    page,
  }) => {
    const name = `${stamp()}-tp14`
    await openCreate(page, 'object')
    await sheet(page).getByLabel(/name/i).first().fill(name)

    await addProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('42')

    await saveSheet(page, { expectClose: false })
    await expect(sheet(page)).toBeVisible()

    // Naming it is the input that fixes the refusal, so the same submit must now
    // reach the node rather than re-refusing from an error nothing cleared.
    await page.getByTestId('property-name-0').fill('Capacity')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await page.goto('/templates')
    await expect(rowFor(page, name)).toHaveCount(1)

    // The property survived the round trip: the refusal protected the work
    // rather than costing it. The sheet reopens on DETAILS, and a saved row then
    // starts collapsed — neither is a missing property.
    await openForEdit(page, name)
    await switchTab(page, 'properties')
    await expect(page.getByTestId('property-row-0')).toHaveCount(1)
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-name-0')).toHaveValue('Capacity')
  })

  test('TP8: a template can be created from an existing object', async ({
    page,
  }) => {
    const objectName = `${stamp()}-tp8`
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'createObject').click()
    await sheet(page).getByLabel(/name/i).first().fill(objectName)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Thickness', '450 mm')
    await addProperty(page, 1)
    await fillProperty(page, 1, 'Material', 'C30/37')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await rowFor(page, objectName)
      .getByTestId('object-actions-dropdown')
      .click()
    await page.getByTestId('object-action-create-template').click()

    // A DIALOG, not the sheet: only the metadata is asked for, and the tree is built from the full
    // object behind it.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const templateName = `${objectName}-tpl`
    await page.locator('#template-name').fill(templateName)
    await dialog.getByRole('button', { name: /create template/i }).click()
    await expect(dialog).toBeHidden()

    // The row that triggered this is LEAN — it carries no properties. Building from it instead of
    // the fetched object would produce an empty template with nothing on screen to say so.
    await page.goto('/templates')
    await openForEdit(page, templateName)
    await switchTab(page, 'properties')
    await expandProperty(page, 0)
    await expandProperty(page, 1)

    // A template is a RECIPE, so values arrive as placeholders: the shape survives, the reading does
    // not. `450 mm` keeps its unit and loses its number; `C30/37` has no leading number at all, so it
    // is instance data and would otherwise be shared by every object made from this template.
    //
    // Both names are dictionary terms, so they read back with their labels. A name the dictionary
    // does not carry is stored as its slug and would read back lowercased.
    await expect(page.getByTestId('property-name-0')).toHaveValue('Thickness')
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('0 mm')
    await expect(page.getByTestId('property-name-1')).toHaveValue('Material')
    await expect(page.getByTestId('property-value-1-0')).toHaveValue('')
  })

  test('TP6: template properties offer no file affordances', async ({
    page,
  }) => {
    await openCreate(page, 'object')
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Material', 'steel')

    // `allowFiles={false}`: io2p routes an attach target through the engine registry, which knows
    // objects and processes only, so an upload aimed at a template is refused.
    await expect(page.getByTestId('property-attach-0')).toHaveCount(0)
    await expect(page.getByTestId('value-attach-0-0')).toHaveCount(0)
    await expect(page.getByTestId('add-files')).toHaveCount(0)
    // A formula recipe IS offered — a template stores one INERT and computes it on apply.
    await expect(page.getByTestId('value-mode-0-0')).toBeVisible()
  })

  test('TP7: an edit writes values by ref, never by the id the read returned', async ({
    page,
  }) => {
    const name = `${stamp()}-tp7`
    await openCreate(page, 'object')
    await sheet(page).getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Depth', '450')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await openForEdit(page, name)
    await switchTab(page, 'properties')
    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('460')

    const request = page.waitForRequest(
      (r) =>
        /\/v1\/templates\/[0-9a-f-]{36}/.test(r.url()) && r.method() !== 'GET'
    )
    await saveSheet(page)
    const body = (await request).postDataJSON()

    // A template save REPLACES the whole tree, so every id the read returned stops existing the
    // moment it is written. Sending one back would dangle any sibling calc bound to it.
    const values = (body.properties ?? []).flatMap(
      (p: { values?: { id?: string; ref?: string }[] }) => p.values ?? []
    )
    expect(values.length).toBeGreaterThan(0)
    for (const value of values) {
      expect(value.ref, 'a template value must carry a client ref').toBeTruthy()
      expect(value.id, 'a server id must never be written back').toBeUndefined()
    }
  })
})
