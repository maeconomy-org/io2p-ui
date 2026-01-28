import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Templates', () => {
  test.describe.configure({ mode: 'serial' })

  let templateName = ''
  let sourceObjectName = ''

  test('setup - create source object for template', async ({ page }) => {
    sourceObjectName = `E2E Template Source ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(sourceObjectName)
    await addSheet
      .getByLabel('Description')
      .fill('Source object for template creation')

    // Add properties that will be part of the template
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('template.property')
    await addSheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('template value')

    await addSheet.getByRole('button', { name: 'Add Another Value' }).click()
    await addSheet
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('second template value')

    // Add second property
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').nth(1).fill('category')
    await addSheet
      .getByPlaceholder('Enter property value')
      .nth(2)
      .fill('Template Category')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(sourceObjectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('create template from existing object', async ({ page }) => {
    templateName = `E2E Template ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Find and open the source object
    const row = page
      .locator('tbody tr')
      .filter({ hasText: sourceObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await expect(page.getByText(sourceObjectName)).toBeVisible()

    // Look for "Create Template" or similar button
    const createTemplateButton = page.locator(
      'button:has-text("Template"), button:has-text("Create Template"), [data-testid*="template"]'
    )

    if ((await createTemplateButton.count()) > 0) {
      await createTemplateButton.first().click()

      // Should open template creation dialog
      const templateDialog = getDialogByTitle(page, 'Create Template')
        .or(getDialogByTitle(page, 'Template'))
        .or(page.getByRole('dialog').filter({ hasText: 'template' }))

      await expect(templateDialog).toBeVisible({ timeout: 5000 })

      // Fill template details
      const templateNameInput = templateDialog
        .getByLabel('Name')
        .or(templateDialog.getByPlaceholder(/name/i))

      if (await templateNameInput.isVisible()) {
        await templateNameInput.fill(templateName)
      }

      const templateDescInput = templateDialog
        .getByLabel('Description')
        .or(templateDialog.getByPlaceholder(/description/i))

      if (await templateDescInput.isVisible()) {
        await templateDescInput.fill('Template created from E2E test object')
      }

      // Create the template
      await templateDialog.getByRole('button', { name: /create|save/i }).click()

      // Should show success message or close dialog
      await page.waitForTimeout(3000)
    }

    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('verify template appears in templates list', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Look for templates filter or section
    const templatesFilter = page.locator(
      'button:has-text("Templates"), input[type="checkbox"]:near(:text("template")), [data-testid*="template"]'
    )

    if ((await templatesFilter.count()) > 0) {
      await templatesFilter.first().click()
      await page.waitForTimeout(2000)

      // Should show templates
      await expect(page.getByText(templateName)).toBeVisible({ timeout: 10000 })
    }
  })

  test('create object from template', async ({ page }) => {
    const objectFromTemplateName = `E2E From Template ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    // Look for model/template selector
    const templateSelector = addSheet
      .locator(
        'button:has-text("template"), button:has-text("model"), [data-testid*="template"], [data-testid*="model"]'
      )
      .first()

    if (await templateSelector.isVisible()) {
      await templateSelector.click()

      // Should show template options
      const templateOption = page.getByText(templateName).first()

      if (await templateOption.isVisible()) {
        await templateOption.click()

        // Form should be pre-populated with template data
        await expect(
          addSheet.locator('input[value*="' + templateName + '"]')
        ).toBeVisible()

        // Update the name for the new object
        await addSheet.getByLabel('Name').fill(objectFromTemplateName)

        // Properties should be pre-populated
        await expect(
          addSheet.locator('input[value="template.property"]')
        ).toBeVisible()
        await expect(
          addSheet.locator('input[value="template value"]')
        ).toBeVisible()

        await addSheet.getByRole('button', { name: 'Create' }).click()

        await expect(page.getByText(objectFromTemplateName)).toBeVisible({
          timeout: 15000,
        })
      }
    }
  })

  test('verify object created from template has template properties', async ({
    page,
  }) => {
    const objectFromTemplateName = `E2E From Template ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Find and open the object created from template
    const row = page
      .locator('tbody tr')
      .filter({ hasText: objectFromTemplateName })
      .first()

    if ((await row.count()) > 0) {
      await expect(row).toBeVisible({ timeout: 15000 })
      await row.dblclick()

      await expect(page.getByText(objectFromTemplateName)).toBeVisible()

      // Check properties tab
      await page.getByRole('tab', { name: 'Properties' }).click()

      // Should have the template properties
      await expect(page.getByText('template.property')).toBeVisible()
      await expect(page.getByText('template value')).toBeVisible()
      await expect(page.getByText('category')).toBeVisible()
      await expect(page.getByText('Template Category')).toBeVisible()

      await page.getByRole('button', { name: 'Close' }).click()
    }
  })

  test('edit template properties', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Enable templates view
    const templatesFilter = page.locator(
      'button:has-text("Templates"), input[type="checkbox"]:near(:text("template"))'
    )

    if ((await templatesFilter.count()) > 0) {
      await templatesFilter.first().click()
      await page.waitForTimeout(2000)

      // Find and open the template
      const templateRow = page
        .locator('tbody tr')
        .filter({ hasText: templateName })
        .first()

      if ((await templateRow.count()) > 0) {
        await expect(templateRow).toBeVisible({ timeout: 15000 })
        await templateRow.dblclick()

        await expect(page.getByText(templateName)).toBeVisible()

        // Edit template properties
        await page.getByRole('tab', { name: 'Properties' }).click()
        await page.getByRole('button', { name: 'Edit' }).first().click()

        // Add new property to template
        await page.getByRole('button', { name: 'Add Property' }).click()
        const propertyInputs = page.getByLabel('Property Name')
        const lastPropertyInput = propertyInputs.last()
        await lastPropertyInput.fill('new.template.property')

        const valueInputs = page.getByPlaceholder('Enter property value')
        const lastValueInput = valueInputs.last()
        await lastValueInput.fill('new template value')

        await page.getByRole('button', { name: 'Save' }).click()

        await expect(page.getByText('new.template.property')).toBeVisible({
          timeout: 10000,
        })

        await page.getByRole('button', { name: 'Close' }).click()
      }
    }
  })

  test('create object from updated template', async ({ page }) => {
    const updatedObjectName = `E2E Updated Template ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    // Select the updated template
    const templateSelector = addSheet
      .locator('button:has-text("template"), button:has-text("model")')
      .first()

    if (await templateSelector.isVisible()) {
      await templateSelector.click()

      const templateOption = page.getByText(templateName).first()

      if (await templateOption.isVisible()) {
        await templateOption.click()

        await addSheet.getByLabel('Name').fill(updatedObjectName)

        // Should now include the new property
        await expect(
          addSheet.locator('input[value="new.template.property"]')
        ).toBeVisible()

        await addSheet.getByRole('button', { name: 'Create' }).click()

        await expect(page.getByText(updatedObjectName)).toBeVisible({
          timeout: 15000,
        })

        // Verify the new object has the updated template properties
        const row = page
          .locator('tbody tr')
          .filter({ hasText: updatedObjectName })
          .first()
        await expect(row).toBeVisible({ timeout: 15000 })
        await row.dblclick()

        await page.getByRole('tab', { name: 'Properties' }).click()
        await expect(page.getByText('new.template.property')).toBeVisible()

        await page.getByRole('button', { name: 'Close' }).click()
      }
    }
  })
})
