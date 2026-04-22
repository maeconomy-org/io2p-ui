import { test, expect } from '@playwright/test'

import { findGroupCard } from '../utils/test-helpers'

/**
 * Group Objects Tests
 *
 * Coverage for:
 * - Create object and add to group via bulk action
 * - Verify object in group via "View Objects"
 * - Select existing object and add to group
 * - Filter objects by group
 * - Clear group filter
 */

const runId = Date.now()

test.describe('04 - Group Objects', () => {
  test.describe.configure({ mode: 'serial' })

  let groupName = ''
  let createdObjectName = ''
  let existingObjectName = ''

  test('TC001: Setup - create group for object tests', async ({ page }) => {
    groupName = `E2E Objects Group ${runId}`

    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

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

  test('TC002: Create object and add to group via bulk action', async ({
    page,
  }) => {
    createdObjectName = `E2E Group Object ${runId}`
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Create a new object
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = page.getByRole('dialog').filter({ hasText: /add object/i })
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(createdObjectName)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Select the created object
    const objectRow = page
      .locator('tbody tr')
      .filter({ hasText: createdObjectName })
    await expect(objectRow).toBeVisible({ timeout: 10000 })
    await objectRow
      .locator('td')
      .first()
      .locator('button[role="checkbox"]')
      .click()

    // Add to group via bulk action
    await page.getByRole('button', { name: /add to group/i }).click()
    await page.getByRole('menuitem', { name: groupName }).click()

    await page.waitForTimeout(2000)
  })

  test('TC003: Verify object appears in group via View Objects', async ({
    page,
  }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    const groupCard = await findGroupCard(page, groupName)

    // Click "View Objects" on the group card
    await groupCard.getByRole('button', { name: /view objects/i }).click()

    // Should navigate to /objects?groupId=...
    await expect(page).toHaveURL(/\/objects\?groupId=/)

    // Verify the created object is in the filtered list
    await expect(page.getByText(createdObjectName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC004: Select existing object and add to group', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Select the first object in the table
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 10000 })

    // Store the object name for verification
    existingObjectName = await firstRow.locator('td').nth(1).innerText()

    await firstRow
      .locator('td')
      .first()
      .locator('button[role="checkbox"]')
      .click()

    // Add to group via bulk action
    await page.getByRole('button', { name: /add to group/i }).click()
    await page.getByRole('menuitem', { name: groupName }).click()

    await page.waitForTimeout(2000)

    // Deselect the row
    await firstRow
      .locator('td')
      .first()
      .locator('button[role="checkbox"]')
      .click()
  })

  test('TC005: Filter objects by group and verify object is listed', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Open the Groups filter
    await page.getByRole('button', { name: /groups/i }).click()

    // Select our group
    const groupOption = page
      .locator('[cmdk-item]')
      .filter({ hasText: groupName })
    await expect(groupOption).toBeVisible({ timeout: 5000 })
    await groupOption.click()

    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    // Verify the existing object we added appears
    await expect(page.getByText(existingObjectName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC006: Clear group filter shows all objects', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Apply the group filter
    await page.getByRole('button', { name: /groups/i }).click()
    const groupOption = page
      .locator('[cmdk-item]')
      .filter({ hasText: groupName })
    await expect(groupOption).toBeVisible({ timeout: 5000 })
    await groupOption.click()
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    // Verify the filter badge shows the group name
    await expect(
      page.getByRole('button', { name: /groups/i }).getByText(groupName)
    ).toBeVisible()

    // Deselect to clear the filter
    await page.getByRole('button', { name: /groups/i }).click()
    await page.locator('[cmdk-item]').filter({ hasText: groupName }).click()
    await page.keyboard.press('Escape')
    await page.waitForLoadState('networkidle')

    // Filter badge should be gone
    await expect(
      page.getByRole('button', { name: /groups/i }).locator('span.truncate')
    ).toBeHidden()
  })
})
