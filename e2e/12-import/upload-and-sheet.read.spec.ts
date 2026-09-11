import { expect, test } from '../fixtures/app'
import { importLimits, loadSheet, openWizard, sheetPath } from '../utils/import'

test.describe('12 - import / upload and sheet', () => {
  test.beforeEach(async ({ page }) => {
    await openWizard(page)
  })

  test('I7: a CSV advances to the Sheet step on its own', async ({ page }) => {
    await loadSheet(page, 'flat.csv')

    await expect(page.getByTestId('wizard-step-sheet')).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(page.getByTestId('sheet-row-summary')).toContainText(
      /Reading 5 rows/
    )
  })

  test('I8: a file that is not a sheet is refused, and the step does not advance', async ({
    page,
  }) => {
    await page
      .getByTestId('import-file-input')
      .setInputFiles(sheetPath('bad.txt'))

    await expect(page.getByTestId('import-parse-error')).toContainText(
      'Only .xlsx and .csv files can be imported'
    )
    await expect(page.getByTestId('import-dropzone')).toBeVisible()
    await expect(page.getByTestId('wizard-step-upload')).toHaveAttribute(
      'aria-current',
      'step'
    )
  })

  test('I9: an over-size file names the deployment’s own limit', async ({
    page,
  }) => {
    const { maxFileMB } = await importLimits(page)
    expect(
      maxFileMB,
      'run the e2e server with MAX_IMPORT_FILE_SIZE_MB=1 — oversize.csv is 2 MB'
    ).toBeLessThan(2)

    await page
      .getByTestId('import-file-input')
      .setInputFiles(sheetPath('oversize.csv'))

    await expect(page.getByTestId('import-parse-error')).toContainText(
      `the limit is ${maxFileMB} MB`
    )
  })

  test('I10: re-picking the same file after an error still fires', async ({
    page,
  }) => {
    const input = page.getByTestId('import-file-input')
    await input.setInputFiles(sheetPath('bad.txt'))
    await expect(page.getByTestId('import-parse-error')).toBeVisible()

    await input.setInputFiles(sheetPath('bad.txt'))
    await expect(page.getByTestId('import-parse-error')).toBeVisible()

    await input.setInputFiles(sheetPath('flat.csv'))
    await expect(page.getByTestId('sheet-row-summary')).toBeVisible()
  })

  test('I11: a workbook offers one chip per sheet with its dimensions', async ({
    page,
  }) => {
    await loadSheet(page, 'multi-sheet.xlsx')

    await expect(page.getByTestId('sheet-option-Buildings')).toBeVisible()
    await expect(page.getByTestId('sheet-option-Plots')).toContainText('4 rows')
    await expect(page.getByTestId('sheet-option-Plots')).toContainText(
      '4 columns'
    )
    await expect(page.getByTestId('sheet-option-Trees')).toContainText('2 rows')
  })

  test('I12: switching sheets re-seeds the mapping', async ({ page }) => {
    await loadSheet(page, 'multi-sheet.xlsx')
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('map-target-1').click()
    await page.getByTestId('map-target-option-skip').click()
    await expect(page.getByTestId('map-target-1')).toContainText("Don't import")

    await page.getByTestId('wizard-step-sheet').click()
    await page.getByTestId('sheet-option-Plots').click()
    await page.getByTestId('wizard-next').click()

    // Plots has four columns and its own headers; column 1 is `owner`, freshly guessed.
    await expect(page.getByTestId('map-column-3')).toBeVisible()
    await expect(page.getByTestId('map-target-1')).not.toContainText(
      "Don't import"
    )
  })

  test('I12b: a trailing blank cell parses the same in XLSX as in CSV', async ({
    page,
  }) => {
    const grids: string[][][] = []
    for (const fixture of ['empty-cells.csv', 'empty-cells.xlsx'] as const) {
      await openWizard(page)
      await loadSheet(page, fixture)
      grids.push(
        // Scoped to the grid: `sheet-row-summary` shares the prefix and is not a row.
        await page
          .locator('tbody [data-testid^="sheet-row-"]')
          .evaluateAll((rows) =>
            rows.map((row) =>
              [...row.querySelectorAll('td')]
                .slice(1)
                .map((cell) => cell.textContent?.trim() ?? '')
            )
          )
      )
    }

    expect(grids[1]).toEqual(grids[0])
  })

  test('I13: the guessed header row carries the badge', async ({ page }) => {
    await loadSheet(page, 'preamble.csv')

    await expect(
      page.getByTestId('sheet-row-3').getByTestId('sheet-header-badge')
    ).toBeVisible()
    await expect(
      page.getByTestId('sheet-row-4').getByTestId('sheet-data-badge')
    ).toBeVisible()
    await expect(page.getByTestId('sheet-row-summary')).toContainText(
      /Reading 5 rows/
    )
  })

  test('I14: marking a different header row re-seeds and re-counts', async ({
    page,
  }) => {
    await loadSheet(page, 'preamble.csv')
    await page.getByTestId('sheet-mark-header-5').click()

    await expect(
      page.getByTestId('sheet-row-5').getByTestId('sheet-header-badge')
    ).toBeVisible()
    await expect(page.getByTestId('sheet-row-summary')).toContainText(
      /Reading 3 rows/
    )

    await page.getByTestId('wizard-next').click()
    await expect(page.getByTestId('map-column-0')).toContainText('South Gate')
  })

  test('I15: a data row above the header clamps to header + 1', async ({
    page,
  }) => {
    await loadSheet(page, 'preamble.csv')
    await page.getByTestId('sheet-mark-data-1').click()

    await expect(
      page.getByTestId('sheet-row-4').getByTestId('sheet-data-badge')
    ).toBeVisible()
    await expect(page.getByTestId('sheet-row-summary')).toContainText(
      /Reading 5 rows/
    )
  })
})
