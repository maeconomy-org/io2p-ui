import { expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'

export type SheetFixture =
  | 'flat.csv'
  | 'preamble.csv'
  | 'levels.csv'
  | 'levels-address.csv'
  | 'keys.csv'
  | 'unicode.csv'
  | 'noname.csv'
  | 'empty-data.csv'
  | 'empty-cells.csv'
  | 'huge.csv'
  | 'many.csv'
  | 'problems.csv'
  | 'oversize.csv'
  | 'bad.txt'
  | 'multi-sheet.xlsx'
  | 'empty-cells.xlsx'

export function sheetPath(fixture: SheetFixture): string {
  return resolve(process.cwd(), 'e2e/fixtures/sheets', fixture)
}

/** `/import` opens on the job list; the wizard is the other tab. */
export async function openWizard(page: Page): Promise<void> {
  await page.goto('/import')
  await expect(page.getByTestId('import-tab-wizard')).toBeVisible()
  // `toPass`: a click landing before hydration does nothing at all, silently.
  await expect(async () => {
    await page.getByTestId('import-tab-wizard').click()
    await expect(page.getByTestId('import-dropzone')).toBeVisible({
      timeout: 5_000,
    })
  }).toPass({ timeout: 60_000 })
}

/** Load a fixture and wait for the Sheet step. The input is hidden by design. */
export async function loadSheet(
  page: Page,
  fixture: SheetFixture
): Promise<void> {
  await page.getByTestId('import-file-input').setInputFiles(sheetPath(fixture))
  await expect(page.getByTestId('sheet-row-summary')).toBeVisible()
}

/** Load a fixture and continue to the mapping step. */
export async function loadAndMap(
  page: Page,
  fixture: SheetFixture
): Promise<void> {
  await loadSheet(page, fixture)
  await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('map-column-0')).toBeVisible()
}

/** Radix renders select content in a portal, so the option is page-scoped, not row-scoped. */
export async function setColumnTarget(
  page: Page,
  column: number,
  target: string
): Promise<void> {
  await page.getByTestId(`map-target-${column}`).click()
  await page.getByTestId(`map-target-option-${target}`).click()
  await expect(page.getByTestId(`map-target-option-${target}`)).toHaveCount(0)
}

export async function setColumnSplit(
  page: Page,
  column: number,
  split: string
): Promise<void> {
  await page.getByTestId(`map-split-${column}`).click()
  await page.getByTestId(`map-split-option-${split}`).click()
  await expect(page.getByTestId(`map-split-option-${split}`)).toHaveCount(0)
}

/**
 * The caps this deployment advertises. The wizard reads them from runtime config, so a spec that
 * hard-coded the product defaults would assert nothing about what the operator is told.
 *
 * The e2e server runs with both lowered — see the plan's §4.9 run command — because the defaults
 * are 100 MB and 50,000 objects, and a fixture that exceeds either is not worth committing.
 */
export async function importLimits(
  page: Page
): Promise<{ maxFileMB: number; maxObjects: number }> {
  return page.evaluate(() => {
    const config = (
      window as unknown as {
        __IOM_CONFIG__?: {
          maxImportFileSizeMB: number
          maxObjectsPerImport: number
        }
      }
    ).__IOM_CONFIG__
    return {
      maxFileMB: config?.maxImportFileSizeMB ?? 100,
      maxObjects: config?.maxObjectsPerImport ?? 50_000,
    }
  })
}

/** The value behind a Check stat tile, which renders it locale-formatted. */
export async function statValue(page: Page, id: string): Promise<number> {
  const raw = await page
    .getByTestId(`check-stat-${id}`)
    .getAttribute('data-value')
  return Number(raw)
}
