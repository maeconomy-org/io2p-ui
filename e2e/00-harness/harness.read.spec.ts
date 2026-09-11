import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

test.describe('00 - harness', () => {
  test('the typed tour() layer resolves anchors the app really renders', async ({
    page,
  }) => {
    await page.goto('/objects')

    await expect(tour(page, 'topNav')).toBeVisible()
    await expect(tour(page, 'navObjects')).toBeVisible()
    await expect(tour(page, 'searchButton')).toBeVisible()
    await expect(tour(page, 'createObject')).toBeVisible()
  })

  test('the api recorder sees the requests the page actually made', async ({
    page,
    api,
  }) => {
    await page.goto('/objects')
    await expect(tour(page, 'createObject')).toBeVisible()

    expect(api.count(/\/objects/)).toBeGreaterThan(0)
    expect(api.matching(/\/objects/)[0]?.path).toContain('/objects')
  })
})
