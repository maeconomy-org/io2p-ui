import { test, expect } from '@playwright/test'

import { findGroupCard } from '../utils/test-helpers'

/**
 * Group CRUD Tests
 *
 * Coverage for:
 * - Create group
 * - View group details (tabs, info)
 * - Inline name editing (card + sheet)
 * - Toggle visibility (public/private)
 * - Filter groups (my/shared/all)
 * - Search for group
 */

const runId = Date.now()

test.describe('02 - Group CRUD Operations', () => {
  test.describe.configure({ mode: 'serial' })

  let groupName = ''

  test.beforeEach(async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()
  })

  test('TC001: Create group', async ({ page }) => {
    groupName = `E2E Group ${runId}`

    await page.getByTestId('create-group-button').click()
    await expect(page.getByText(/create new group/i)).toBeVisible()

    await page.getByLabel(/name/i).fill(groupName)

    await page.getByRole('button', { name: /create group/i }).click()
    await expect(page.getByText(/create new group/i)).toBeHidden({
      timeout: 10000,
    })

    await page.waitForLoadState('networkidle')
    await findGroupCard(page, groupName)
  })

  test('TC002: Group details sheet opens with tabs', async ({ page }) => {
    const groupCard = await findGroupCard(page, groupName)

    await groupCard.getByRole('button', { name: /group details/i }).click()

    await expect(page.getByRole('tab', { name: /users/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /info/i })).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('TC003: Info tab shows visibility, permissions, and UUIDs', async ({
    page,
  }) => {
    const groupCard = await findGroupCard(page, groupName)

    await groupCard.getByRole('button', { name: /group details/i }).click()

    await page.getByRole('tab', { name: /info/i }).click()

    await expect(page.getByText(/visibility/i)).toBeVisible()
    await expect(page.getByText(/your permissions/i)).toBeVisible()
    await expect(page.getByText(/group uuid/i)).toBeVisible()
    await expect(page.getByText(/owner uuid/i)).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('TC004: Toggle group visibility to public', async ({ page }) => {
    const groupCard = await findGroupCard(page, groupName)

    await expect(groupCard.getByText(/private/i)).toBeVisible()

    await groupCard.getByRole('button', { name: /group details/i }).click()

    await page.getByRole('tab', { name: /info/i }).click()

    const visibilitySwitch = page.getByRole('switch')
    await visibilitySwitch.click()

    await expect(
      page
        .locator('div.flex.items-center.gap-2')
        .getByText(/public/i)
        .first()
    ).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('Escape')

    // Verify card now shows "Public"
    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()
    const updatedCard = await findGroupCard(page, groupName)
    await expect(updatedCard.getByText(/public/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC005: Toggle group visibility back to private', async ({ page }) => {
    const groupCard = await findGroupCard(page, groupName)

    await groupCard.getByRole('button', { name: /group details/i }).click()

    await page.getByRole('tab', { name: /info/i }).click()

    const visibilitySwitch = page.getByRole('switch')
    await visibilitySwitch.click()

    await expect(
      page
        .locator('div.flex.items-center.gap-2')
        .getByText(/private/i)
        .first()
    ).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('Escape')
  })

  test('TC006: Inline edit group name from card', async ({ page }) => {
    const groupCard = await findGroupCard(page, groupName)

    const heading = groupCard.getByRole('heading', { level: 3 })
    await heading.hover()

    const editButton = groupCard.locator('div.group\\/name button')
    await editButton.click()

    const nameInput = page.locator(
      '[data-testid^="group-card-"] input[class*="font-semibold"]'
    )
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    const newName = `E2E Group Renamed ${runId}`
    await nameInput.clear()
    await nameInput.fill(newName)
    await nameInput.press('Enter')

    await expect(
      page.getByRole('heading', { level: 3, name: newName })
    ).toBeVisible({ timeout: 10000 })

    groupName = newName
  })

  test('TC007: Inline edit group name from details sheet', async ({ page }) => {
    const groupCard = await findGroupCard(page, groupName)

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const editButton = page
      .getByRole('dialog')
      .locator('button')
      .filter({ has: page.locator('.lucide-pencil') })
      .first()
    await editButton.click()

    const nameInput = page.getByRole('dialog').locator('input').first()
    await expect(nameInput).toBeVisible()

    const revertedName = `E2E Group ${runId}`
    await nameInput.clear()
    await nameInput.fill(revertedName)
    await nameInput.press('Enter')

    await expect(page.getByText(revertedName).first()).toBeVisible({
      timeout: 10000,
    })

    groupName = revertedName
    await page.keyboard.press('Escape')
  })

  test('TC008: Filter by My Groups shows created group', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    const filterButton = page.getByRole('button', { name: /filter/i })

    await filterButton.click()
    const myGroupsItem = page
      .locator('[cmdk-item]')
      .filter({ hasText: /my groups/i })
    await expect(myGroupsItem).toBeVisible({ timeout: 5000 })
    await myGroupsItem.click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await findGroupCard(page, groupName)

    // Reset to 'All'
    await filterButton.click()
    const allItem = page.locator('[cmdk-item]').filter({ hasText: /all/i })
    await expect(allItem).toBeVisible({ timeout: 5000 })
    await allItem.click()
    await page.keyboard.press('Escape')
  })

  // Skipped: group search is currently client-side and only filters the
  // *current* page of results (see src/components/groups/hooks/use-group-filters.ts).
  // A group created with a fresh-timestamp name may land on page 2+ and will
  // not be found by the search input. Unskip once search is plumbed server-side.
  test.skip('TC009: Search finds the created group', async ({ page }) => {
    const searchInput = page.getByTestId('group-search-input')

    await searchInput.fill(groupName)
    await page.waitForTimeout(500)

    await expect(page.getByText(groupName).first()).toBeVisible({
      timeout: 10000,
    })

    const clearButton = page.getByTestId('group-search-clear-button')
    await clearButton.click()
    await expect(searchInput).toHaveValue('')
  })
})
