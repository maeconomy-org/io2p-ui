import { expect, test } from '../fixtures/app'
import { BASE, job, serveJobs } from '../utils/import-jobs'

test.describe('12 - import / jobs', () => {
  test('I63: every status is told apart without colour', async ({ page }) => {
    const statuses = [
      'draft',
      'queued',
      'running',
      'completed',
      'completed_with_errors',
      'failed',
      'cancelled',
    ]
    await serveJobs(
      page,
      statuses.map((status, index) =>
        job({ id: `0000000${index}-0000-7000-8000-000000000001`, status })
      )
    )
    await page.goto('/import')

    for (const status of statuses) {
      await expect(page.locator(`[data-status="${status}"]`)).toHaveCount(1)
    }
  })

  test('I46/I47: page one reads as 1, and the arrows actually page', async ({
    page,
    api,
  }) => {
    await serveJobs(page, [job({ id: BASE.id })], {
      totalPages: 3,
      totalElements: 45,
    })
    await page.goto('/import')
    await expect(page.getByTestId('data-table-row')).toHaveCount(1)

    // The node counts from 1 and DataTable subtracts one itself; the `- 1` that used to be here
    // rendered page one as −1.
    await expect(page.getByTestId('page-indicator')).toContainText('1')
    await expect(page.getByTestId('page-indicator')).not.toContainText('-1')

    await page.getByTestId('page-next').click()

    await expect.poll(() => api.count(/\/v1\/imports\?.*page=2/)).toBe(1)
  })

  test('I48: a draft shows staging progress, never a 0-of-N outcome bar', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({ id: BASE.id, status: 'draft', staged: 320, processed: 0, ok: 0 }),
    ])
    await page.goto('/import')

    await expect(page.getByTestId('job-staging-progress')).toContainText('320')
    await expect(page.getByTestId('outcome-bar')).toHaveCount(0)
  })

  test('I49: a job that ended without running says nothing was attempted', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({
        id: BASE.id,
        status: 'cancelled',
        staged: 500,
        processed: 0,
        ok: 0,
      }),
    ])
    await page.goto('/import')

    await expect(page.getByTestId('job-nothing-attempted')).toBeVisible()
    await expect(page.getByTestId('outcome-bar')).toHaveCount(0)
  })

  test('I50: completed_with_errors is translated, never underscore-swapped', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({
        id: BASE.id,
        status: 'completed_with_errors',
        ok: 380,
        failed: 100,
        skipped: 20,
      }),
    ])
    await page.goto('/import')

    const badge = page.getByTestId('job-status')
    await expect(badge).toHaveAttribute('data-status', 'completed_with_errors')
    await expect(badge).not.toContainText('with_errors')
  })

  test('I51/I52: the headline is ok, and the bar’s label states all four counts', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({
        id: BASE.id,
        status: 'completed_with_errors',
        processed: 500,
        ok: 380,
        failed: 100,
        skipped: 20,
      }),
    ])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    // `processed - failed` would say 400: skipped rows are not created, and skipped is what
    // happens to every child of a failed parent.
    await expect(page.getByTestId('job-headline')).toContainText('380')
    await expect(page.getByTestId('job-headline')).not.toContainText('400')
    await expect(page.getByTestId('outcome-bar')).toHaveAttribute(
      'aria-label',
      /380.*100.*20.*500/
    )
  })

  test('I53: failed and skipped are separate tabs counted from the JOB', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({
        id: BASE.id,
        status: 'completed_with_errors',
        ok: 380,
        failed: 100,
        skipped: 20,
      }),
    ])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    // 100 and 20 come from the job; the tables below hold two rows and one.
    await expect(page.getByTestId('job-tab-failed')).toContainText('100')
    await expect(page.getByTestId('job-tab-skipped')).toContainText('20')

    await expect(page.getByTestId('job-item-1')).toBeVisible()
    await page.getByTestId('job-tab-skipped').click()
    await expect(page.getByTestId('job-item-3')).toBeVisible()
  })

  test('I54/I55: the CSV walks every page and opens as UTF-8', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({ id: BASE.id, status: 'completed_with_errors', failed: 100 }),
    ])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    const download = page.waitForEvent('download')
    await page.getByTestId('job-download-csv').click()
    const stream = await (await download).createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const csv = Buffer.concat(chunks).toString('utf8')

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Naam ontbreekt in deze rij')
    // Both statuses, walked by `paginateItems` rather than read off the 20 rows on screen.
    expect(csv).toContain('skipped')
    // The NUL that keys a level path renders as ` / `, never as zero pixels.
    expect(csv).toContain('Northgate House / Ground / Room 1')
  })

  test('I56: a running job shows that it is polling', async ({ page }) => {
    await serveJobs(page, [
      job({ id: BASE.id, status: 'running', processed: 210, ok: 210 }),
    ])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    await expect(page.getByTestId('job-polling')).toBeVisible()
    await expect(page.getByTestId('job-cancel')).toBeEnabled()
  })

  test('I57: Cancel holds at "stopping" and does not spring back', async ({
    page,
  }) => {
    await serveJobs(page, [job({ id: BASE.id, status: 'running' })])
    await page.route('**/v1/imports/*/cancel', async (route) => {
      // Cancel is cooperative: the worker notices at the next batch boundary, so the job stays
      // `running` for a moment. A button that springs back invites a second click.
      await new Promise((done) => setTimeout(done, 1_000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(job({ id: BASE.id, status: 'running' })),
      })
    })
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    await page.getByTestId('job-cancel').click()
    await expect(page.getByTestId('job-cancel')).toBeDisabled()
    await page.waitForTimeout(2_000)
    await expect(page.getByTestId('job-cancel')).toBeDisabled()
  })

  test('I58: discarding a draft confirms by name first', async ({
    page,
    api,
  }) => {
    await serveJobs(page, [job({ id: BASE.id, status: 'draft', staged: 500 })])
    await page.route('**/v1/imports/*/cancel', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(job({ id: BASE.id, status: 'cancelled' })),
      })
    )
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()
    await page.getByTestId('job-discard').click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('northgate-rooms.xlsx')
    await dialog.getByRole('button', { name: /discard/i }).click()

    await expect.poll(() => api.count(/\/cancel$/)).toBe(1)
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('I59: a part-staged draft offers the stalled alert instead of Start', async ({
    page,
  }) => {
    await serveJobs(page, [
      job({ id: BASE.id, status: 'draft', staged: 320, total: 500 }),
    ])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    await expect(page.getByTestId('job-stalled')).toBeVisible()
    await expect(page.getByTestId('job-start')).toHaveCount(0)
    await expect(page.getByTestId('job-discard')).toBeVisible()
  })

  test('I59b: a fully staged draft offers Start', async ({ page }) => {
    await serveJobs(page, [
      job({ id: BASE.id, status: 'draft', staged: 500, total: 500 }),
    ])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()

    await expect(page.getByTestId('job-start')).toBeVisible()
    await expect(page.getByTestId('job-stalled')).toHaveCount(0)
  })

  test('I60: opening a job leaves the URL alone, and a reload returns to the list', async ({
    page,
  }) => {
    await serveJobs(page, [job({ id: BASE.id })])
    await page.goto('/import')
    await page.getByTestId('data-table-row').first().click()
    await expect(page.getByTestId('job-headline')).toBeVisible()

    // Asserted DELIBERATELY: restoring a deep link should mean updating this test rather than
    // discovering the gap.
    await expect(page).toHaveURL(/\/import$/)
    await page.reload()
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('job-headline')).toHaveCount(0)
  })
})
