import { expect, test } from '../fixtures/app'
import { openWizard, statValue } from '../utils/import'
import { tour } from '../utils/selectors'

/**
 * The only import specs that WRITE. Objects land at node scope and an append-only store cannot
 * take them back, so every run carries a per-run prefix in the sheet itself and the fixture is
 * built in memory rather than read from disk.
 */

function runSheet(prefix: string) {
  return {
    name: `${prefix}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'name,description,size',
        `${prefix} North,Main entrance,120`,
        `${prefix} South,Service entrance,80`,
        `${prefix} East,Offices,240`,
      ].join('\n'),
      'utf8'
    ),
  }
}

test.describe('12 - import / run', () => {
  test('I41/I44: staging, hand-off, and the new job at the top of the list', async ({
    page,
  }) => {
    const prefix = `e2e-${Date.now()}`
    await openWizard(page)

    // Slowed so the staging screen is observable at all: three rows stage in one round trip.
    await page.route('**/v1/imports/*/items', async (route) => {
      await new Promise((done) => setTimeout(done, 1_500))
      await route.continue()
    })

    await page.getByTestId('import-file-input').setInputFiles(runSheet(prefix))
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('wizard-next').click()
    expect(await statValue(page, 'objects')).toBe(3)
    await page.getByTestId('wizard-next').click()

    await page.getByTestId('run-start').click()
    await expect(page.getByTestId('run-staged')).toBeVisible()
    await expect(page.getByTestId('run-handed-over')).toBeVisible({
      timeout: 30_000,
    })

    await page.getByTestId('run-see-status').click()
    await expect(page.getByTestId('data-table-row').first()).toContainText(
      `${prefix}.csv`
    )
  })

  test('I42/I43: a refusal returns to the mapping and retires the draft', async ({
    page,
    api,
  }) => {
    const prefix = `e2e-${Date.now()}`
    await openWizard(page)

    // Injected: the node accepts everything this wizard can build, and the refusal path is the
    // one that decides whether hours of mapping survive.
    await page.route('**/v1/imports/*/validate', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          problems: [{ seq: 1, tempId: 'row-3', message: 'injected refusal' }],
        }),
      })
    )

    await page.getByTestId('import-file-input').setInputFiles(runSheet(prefix))
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('map-target-2').click()
    await page.getByTestId('map-target-option-description').click()
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('run-start').click()

    await expect(page.getByTestId('run-refused')).toContainText(
      'injected refusal'
    )

    await page.getByTestId('run-back-to-mapping').click()

    // Chunk keys are positional, so re-staging a changed mapping would no-op against keys the
    // node has already seen — the draft has to go.
    await expect
      .poll(() => api.count(/\/v1\/imports\/[^/]+\/cancel/))
      .toBeGreaterThan(0)
    await expect(page.getByTestId('map-column-0')).toBeVisible()
    await expect(page.getByTestId('map-target-2')).toContainText('Description')
  })

  test('I45: a started import settles after you navigate away', async ({
    page,
    api,
  }) => {
    const prefix = `e2e-${Date.now()}`
    await openWizard(page)

    // Three rows finish in well under one poll, so the job is held `running` until the assertions
    // that need a live watcher have run. Without this there is nothing left to observe.
    let finished = false
    await page.route(/\/v1\/imports\/[^/?]+$/, async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      return route.fulfill({
        response,
        json: finished ? body : { ...body, status: 'running' },
      })
    })

    await page.getByTestId('import-file-input').setInputFiles(runSheet(prefix))
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('run-start').click()
    await expect(page.getByTestId('run-handed-over')).toBeVisible({
      timeout: 30_000,
    })

    // A CLIENT navigation. `page.goto` is a full document load, which tears down the React tree
    // the watcher lives in — that is a browser reload, not "navigating away".
    await tour(page, 'navObjects').click()
    await expect(page).toHaveURL(/\/objects$/)
    await expect(page.getByTestId('data-table')).toBeVisible()
    api.clear()

    // `ImportWatchers` is mounted in `providers.tsx`, above the router — this is app-shell
    // behaviour, not page behaviour.
    await expect
      .poll(() => api.count(/\/v1\/imports\/[0-9a-f-]{36}$/), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0)

    finished = true
    // Reaching a terminal status invalidates the objects list — the one the user is looking at.
    api.clear()
    await expect
      .poll(() => api.count(/\/v1\/objects\?/), { timeout: 15_000 })
      .toBeGreaterThan(0)
  })
})
