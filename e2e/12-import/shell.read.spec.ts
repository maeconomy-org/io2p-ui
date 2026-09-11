import { expect, test } from '../fixtures/app'
import { loadAndMap, loadSheet, openWizard } from '../utils/import'

/**
 * `.read.` — the wizard parses in the browser and writes nothing until `run-start`, which lives in
 * `run.spec.ts`.
 */

test.describe('12 - import / shell', () => {
  test('I1: two tabs, and the job list is what you land on', async ({
    page,
  }) => {
    await page.goto('/import')

    await expect(page.getByTestId('import-tabs')).toBeVisible()
    await expect(page.getByTestId('import-tab-status')).toHaveAttribute(
      'data-state',
      'active'
    )
    await expect(page.getByTestId('import-tab-wizard')).toHaveAttribute(
      'data-state',
      'inactive'
    )
  })

  test('I2: the empty state offers New import and it switches to the wizard', async ({
    page,
  }) => {
    await page.goto('/import')
    const start = page.getByTestId('import-new')
    test.skip(
      (await start.count()) === 0,
      'the account already has import jobs, so there is no empty state'
    )

    await start.click()
    await expect(page.getByTestId('import-dropzone')).toBeVisible()
  })

  test('I3: a mapping survives a trip to the status tab and back', async ({
    page,
  }) => {
    await openWizard(page)
    await loadAndMap(page, 'flat.csv')

    await page.getByTestId('import-tab-status').click()
    await expect(page.getByTestId('import-dropzone')).toBeHidden()
    await page.getByTestId('import-tab-wizard').click()

    await expect(page.getByTestId('map-column-0')).toBeVisible()
    await expect(page.getByTestId('map-column-0')).toContainText('name')
  })

  test('I4: the wizard fetches nothing before a file is picked', async ({
    page,
    api,
  }) => {
    await page.goto('/import')
    await expect(page.getByTestId('import-tab-wizard')).toBeVisible()

    api.clear()
    await page.getByTestId('import-tab-wizard').click()
    await expect(page.getByTestId('import-dropzone')).toBeVisible()

    await expect.poll(() => api.count(/\/v1\/imports/)).toBe(0)
  })

  test('I5: the stepper is back-only — an unreached step is disabled', async ({
    page,
  }) => {
    await openWizard(page)
    await loadSheet(page, 'flat.csv')

    await expect(page.getByTestId('wizard-step-sheet')).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(page.getByTestId('wizard-step-upload')).toBeEnabled()
    await expect(page.getByTestId('wizard-step-map')).toBeDisabled()
    await expect(page.getByTestId('wizard-step-check')).toBeDisabled()
  })

  test('I6: jumping back to Map from Check keeps the mapping', async ({
    page,
  }) => {
    await openWizard(page)
    await loadAndMap(page, 'flat.csv')
    await page.getByTestId('map-target-2').click()
    await page.getByTestId('map-target-option-description').click()

    await page.getByTestId('wizard-next').click()
    await expect(page.getByTestId('check-stat-objects')).toBeVisible()
    await page.getByTestId('wizard-step-map').click()

    await expect(page.getByTestId('map-target-2')).toContainText(/description/i)
  })

  test('I64: the step list is an ordered list with aria-current on the active step', async ({
    page,
  }) => {
    await openWizard(page)

    const stepper = page.getByTestId('wizard-stepper')
    expect(await stepper.evaluate((node) => node.tagName)).toBe('OL')
    await expect(stepper.locator('[aria-current="step"]')).toHaveCount(1)
  })
})
