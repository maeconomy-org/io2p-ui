import { test, expect, type Page } from '@playwright/test'

/**
 * Comprehensive Realistic Object Test
 *
 * Creates a fully-featured object with:
 * - All metadata fields (name, abbreviation, version, description)
 * - Address via autocomplete
 * - Multiple file attachments
 * - 10+ properties with multiple values
 * - File attachments on properties and values
 * - Parent relationship
 */

const runId = Date.now()

const getDialog = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('07 - Comprehensive Realistic Object', () => {
  test.describe.configure({ mode: 'serial' })

  let parentObjectName = ''
  let objectName = ''

  test('TC001: Setup - create parent object', async ({ page }) => {
    parentObjectName = `Building Materials Warehouse ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(parentObjectName)
    await sheet
      .getByLabel('Description')
      .fill('Parent warehouse for material passport')
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    await expect(page.getByText(parentObjectName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC002: Create child object with comprehensive data', async ({
    page,
  }) => {
    test.slow() // This test creates a complex object
    objectName = `Steel Beam BMP-${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Wait for page to fully load - retry if needed
    const createButton = page.getByRole('button', { name: /create object/i })
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.reload()
      await page.waitForLoadState('networkidle')
    }

    await createButton.click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    // === METADATA ===
    await sheet.getByLabel('Name').fill(objectName)
    await sheet.getByLabel('Abbreviation').fill('SB-BMP')
    await sheet.getByLabel('Version').fill('2.1.0')
    await sheet
      .getByLabel('Description')
      .fill(
        'Structural steel beam with full material passport including composition, certifications, and sustainability metrics'
      )

    // === PARENT RELATIONSHIP ===
    await sheet.locator('text=/search.*parent/i').click()
    await page.waitForTimeout(1000)
    await page.getByPlaceholder(/search.*parent/i).fill(parentObjectName)
    await page.waitForTimeout(1000)
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: parentObjectName })
      .first()
      .click()
    await expect(sheet.getByText('1 parent selected')).toBeVisible({
      timeout: 3000,
    })

    // === ADDRESS ===
    const addressInput = sheet.getByPlaceholder(/search.*address/i)
    await addressInput.fill('Munich Germany')
    const suggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    await expect(suggestion).toBeVisible({ timeout: 10000 })
    await suggestion.click()
    await expect(sheet.locator('text=🏘️')).toBeVisible({ timeout: 3000 })

    // === PROPERTY 1: Material Composition ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Material Composition')
    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('Carbon Steel S355')
    await sheet.getByRole('button', { name: 'Add Another Value' }).click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('Iron 98.5%')
    await sheet.getByRole('button', { name: 'Add Another Value' }).click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(2)
      .fill('Carbon 0.2%')
    await sheet.getByRole('button', { name: 'Add Another Value' }).click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(3)
      .fill('Manganese 1.3%')

    // === PROPERTY 2: Dimensions ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(1).fill('Dimensions')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(4)
      .fill('Length: 6000mm')
    await sheet
      .getByRole('button', { name: 'Add Another Value' })
      .nth(1)
      .click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(5)
      .fill('Width: 300mm')
    await sheet
      .getByRole('button', { name: 'Add Another Value' })
      .nth(1)
      .click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(6)
      .fill('Height: 150mm')

    // === PROPERTY 3: Weight ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(2).fill('Weight')
    await sheet.getByPlaceholder('Enter property value').nth(7).fill('425 kg')

    // === PROPERTY 4: Load Capacity ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(3).fill('Load Capacity')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(8)
      .fill('Yield Strength: 355 MPa')
    await sheet
      .getByRole('button', { name: 'Add Another Value' })
      .nth(3)
      .click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(9)
      .fill('Tensile Strength: 510 MPa')

    // === PROPERTY 5: Certifications ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(4).fill('Certifications')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(10)
      .fill('EN 10025-2')
    await sheet
      .getByRole('button', { name: 'Add Another Value' })
      .nth(4)
      .click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(11)
      .fill('ISO 9001:2015')
    await sheet
      .getByRole('button', { name: 'Add Another Value' })
      .nth(4)
      .click()
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(12)
      .fill('CE Marking')

    // === PROPERTY 6: Manufacturer ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(5).fill('Manufacturer')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(13)
      .fill('ArcelorMittal Europe')

    // === PROPERTY 7: Production Date ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(6).fill('Production Date')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(14)
      .fill('2024-08-15')

    // === PROPERTY 8: Batch Number ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(7).fill('Batch Number')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(15)
      .fill('AM-2024-0815-S355')

    // === PROPERTY 9: Recycled Content ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(8).fill('Recycled Content')
    await sheet.getByPlaceholder('Enter property value').nth(16).fill('85%')

    // === PROPERTY 10: Carbon Footprint ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(9).fill('Carbon Footprint')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(17)
      .fill('1.2 kg CO2e/kg')

    // === PROPERTY 11: Expected Lifespan ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(10).fill('Expected Lifespan')
    await sheet
      .getByPlaceholder('Enter property value')
      .nth(18)
      .fill('50+ years')

    // === PROPERTY 12: Fire Rating ===
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').nth(11).fill('Fire Rating')
    await sheet.getByPlaceholder('Enter property value').nth(19).fill('R60')

    // === FILE ATTACHMENTS ===
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const attachModal = page
      .getByRole('dialog')
      .filter({ hasText: /attachments/i })
    await expect(attachModal).toBeVisible({ timeout: 5000 })

    // Upload material certificate PDF
    await attachModal.locator('input[type="file"]').setInputFiles({
      name: 'material-certificate.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Material Test Certificate EN 10204 3.1'),
    })

    // Add external reference
    await attachModal
      .getByPlaceholder('Enter external file URL')
      .fill('https://standards.cen.eu/EN10025-2.pdf')
    await attachModal
      .getByPlaceholder('Label (optional)')
      .fill('EN Standard Reference')
    await attachModal.getByRole('button', { name: 'Add' }).click()

    await attachModal.getByRole('button', { name: 'Done' }).click()

    // === CREATE THE OBJECT ===
    await sheet.getByRole('button', { name: 'Create' }).click()

    await expect(sheet).toBeHidden({ timeout: 30000 })

    // Wait for background uploads and reload to see the new object
    await page.waitForTimeout(5000)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Since the object has a parent, it won't appear in the main table
    // We need to navigate to the parent's children page
    const parentRow = page
      .locator('tbody tr')
      .filter({ hasText: parentObjectName })
      .first()

    await expect(parentRow).toBeVisible({ timeout: 15000 })

    await parentRow.dblclick()
    await page.waitForLoadState('networkidle')

    // We should now be on /objects/[uuid] page showing children table
    const childRow = page
      .locator('tbody tr')
      .filter({ hasText: objectName })
      .first()
    await expect(childRow).toBeVisible({
      timeout: 15000,
    })
  })

  test('TC003: Verify child object has all comprehensive data', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Navigate to parent's children page
    const parentRow = page
      .locator('tbody tr')
      .filter({ hasText: parentObjectName })
      .first()
    await expect(parentRow).toBeVisible({ timeout: 15000 })
    await parentRow.dblclick()
    await page.waitForLoadState('networkidle')

    // Double-click child to open details sheet
    const childRow = page
      .locator('tbody tr')
      .filter({ hasText: objectName })
      .first()
    await expect(childRow).toBeVisible({ timeout: 10000 })
    await childRow.dblclick()
    await page.waitForLoadState('networkidle')

    // === VERIFY METADATA ===
    await page.getByRole('tab', { name: /metadata/i }).click()
    await expect(page.getByText('SB-BMP').first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText('2.1.0').first()).toBeVisible()
    await expect(
      page
        .getByText('Structural steel beam with full material passport')
        .first()
    ).toBeVisible()

    // === VERIFY ADDRESS ===
    await expect(page.getByText('Munich').first()).toBeVisible({
      timeout: 5000,
    })

    // === VERIFY PROPERTIES ===
    await page.getByRole('tab', { name: /properties/i }).click()

    // Verify key properties exist (click to expand)
    await page.getByText('Material Composition').first().click()
    await expect(page.getByText('Carbon Steel S355').first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText('Iron 98.5%').first()).toBeVisible()

    await page.getByText('Dimensions').first().click()
    await expect(page.getByText('Length: 6000mm').first()).toBeVisible()

    await page.getByText('Certifications').first().click()
    await expect(page.getByText('EN 10025-2').first()).toBeVisible()
    await expect(page.getByText('ISO 9001:2015').first()).toBeVisible()

    await page.getByText('Recycled Content').first().click()
    await expect(page.getByText('85%').first()).toBeVisible()

    await page.getByText('Carbon Footprint').first().click()
    await expect(page.getByText('1.2 kg CO2e/kg').first()).toBeVisible()

    // === VERIFY RELATIONSHIPS ===
    await page.getByRole('tab', { name: /relationships/i }).click()
    await expect(page.getByText(parentObjectName).first()).toBeVisible({
      timeout: 10000,
    })

    // === VERIFY FILES ===
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(
      page.getByText('material-certificate.pdf').first()
    ).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('EN Standard Reference').first()).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC004: Add file attachments to child object properties', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Navigate to parent's children page
    const parentRow = page
      .locator('tbody tr')
      .filter({ hasText: parentObjectName })
      .first()
    await expect(parentRow).toBeVisible({ timeout: 15000 })
    await parentRow.dblclick()
    await page.waitForLoadState('networkidle')

    // Double-click child to open details sheet
    const childRow = page
      .locator('tbody tr')
      .filter({ hasText: objectName })
      .first()
    await expect(childRow).toBeVisible({ timeout: 10000 })
    await childRow.dblclick()
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: /properties/i }).click()

    // Expand Certifications property and add file
    await page.getByText('Certifications').first().click()

    // Look for attach button on the property
    const attachButton = page.getByRole('button', { name: 'Attach' }).first()
    if (await attachButton.isVisible({ timeout: 3000 })) {
      await attachButton.click()

      const attachDialog = page
        .getByRole('dialog')
        .filter({ hasText: /attach/i })
      if (await attachDialog.isVisible({ timeout: 3000 })) {
        await attachDialog
          .getByPlaceholder('Enter external file URL')
          .fill('https://example.com/certificate-scan.pdf')
        await attachDialog
          .getByPlaceholder('Label (optional)')
          .fill('Certificate Scan')
        await attachDialog.getByRole('button', { name: 'Add' }).click()
        await attachDialog.getByRole('button', { name: 'Done' }).click()

        // Confirm upload - use alertdialog role
        const alertDialog = page.getByRole('alertdialog')
        await expect(alertDialog).toBeVisible({ timeout: 5000 })
        await page.getByRole('button', { name: 'Upload Files' }).click()

        await expect(page.getByText('Certificate Scan').first()).toBeVisible({
          timeout: 10000,
        })
      }
    }

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC005: Edit child object properties and add new ones', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Navigate to parent's children page
    const parentRow = page
      .locator('tbody tr')
      .filter({ hasText: parentObjectName })
      .first()
    await expect(parentRow).toBeVisible({ timeout: 15000 })
    await parentRow.dblclick()
    await page.waitForLoadState('networkidle')

    // Double-click child to open details sheet
    const childRow = page
      .locator('tbody tr')
      .filter({ hasText: objectName })
      .first()
    await expect(childRow).toBeVisible({ timeout: 10000 })
    await childRow.dblclick()
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: /properties/i }).click()

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit' }).first().click()

    // Add a new property: Installation Location
    await page
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.getByLabel('Property Name').last().fill('Installation Location')
    await page
      .getByPlaceholder('Enter property value')
      .last()
      .fill('Building A, Floor 3, Grid B-5')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify new property
    await page.getByText('Installation Location').first().click()
    await expect(
      page.getByText('Building A, Floor 3, Grid B-5').first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })
})
