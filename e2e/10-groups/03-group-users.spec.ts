import { test, expect } from '@playwright/test'

/**
 * Group User Management Tests
 *
 * Coverage for:
 * - Add user to group by UUID
 * - Verify user count on card
 * - Edit user permissions
 * - Remove user from group
 */

const runId = Date.now()
const testUserUUID = '4885b7fe-0a19-4151-84a6-1c3c1944a409'

test.describe('03 - Group User Management', () => {
  test.describe.configure({ mode: 'serial' })

  let groupName = ''

  test.beforeEach(async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()
  })

  test('TC001: Setup - create group for user tests', async ({ page }) => {
    groupName = `E2E Users Group ${runId}`

    await page.getByTestId('create-group-button').click()
    await expect(page.getByText(/create new group/i)).toBeVisible()

    await page.getByLabel(/name/i).fill(groupName)

    await page.getByRole('button', { name: /create group/i }).click()
    await expect(page.getByText(/create new group/i)).toBeHidden({
      timeout: 10000,
    })

    await page.waitForLoadState('networkidle')
    await expect(page.getByText(groupName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC002: Add user to group', async ({ page }) => {
    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Verify empty state
    await expect(
      dialog.getByText(/no users shared with this group/i)
    ).toBeVisible()

    // Click "Add User" button
    await dialog.getByRole('button', { name: /add user/i }).click()

    // Fill in user UUID and submit
    await dialog.getByPlaceholder(/enter user uuid/i).fill(testUserUUID)
    await dialog
      .locator('div.space-y-2.p-3')
      .getByRole('button')
      .filter({ has: page.locator('.lucide-plus') })
      .click()

    // Verify user appears in the list
    await expect(dialog.getByText(testUserUUID).first()).toBeVisible({
      timeout: 10000,
    })

    await page.keyboard.press('Escape')
  })

  test('TC003: Verify user count on group card', async ({ page }) => {
    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    // Card should now show "1 user"
    await expect(groupCard.getByText(/1 user/i)).toBeVisible()
  })

  test('TC004: Edit user permissions', async ({ page }) => {
    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')

    await expect(dialog.getByText(testUserUUID).first()).toBeVisible({
      timeout: 10000,
    })

    // Click pencil/edit button on the user row
    const userRow = dialog
      .locator('div.flex.items-center.justify-between')
      .filter({ hasText: testUserUUID })
    await userRow
      .locator('button')
      .filter({ has: page.locator('.lucide-pencil') })
      .click()

    // Enable GROUP_WRITE permission
    const groupWriteCheckbox = dialog
      .locator('label')
      .filter({ hasText: /write/i })
      .filter({ hasNotText: /record/i })
      .locator('button[role="checkbox"]')
    await groupWriteCheckbox.click()

    // Confirm permission change
    await userRow.locator('button.text-green-600').click()

    // Verify permission badge is updated
    await expect(dialog.getByText(/write/i).first()).toBeVisible({
      timeout: 10000,
    })

    await page.keyboard.press('Escape')
  })

  test('TC005: Remove user from group', async ({ page }) => {
    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')

    await expect(dialog.getByText(testUserUUID).first()).toBeVisible({
      timeout: 10000,
    })

    // Click the destructive-colored trash button
    await dialog.locator('button.text-destructive').click()

    // Verify user is removed — empty state reappears
    await expect(
      dialog.getByText(/no users shared with this group/i)
    ).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('Escape')
  })

  test('TC006: Verify user count reset on group card', async ({ page }) => {
    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    // Card should show "No users" again
    await expect(groupCard.getByText(/no users/i)).toBeVisible()
  })
})
