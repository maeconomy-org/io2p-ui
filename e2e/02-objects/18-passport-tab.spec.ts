import { test, expect, type Locator, type Page } from '@playwright/test'

import { getDialog } from '../utils/test-helpers'

/**
 * Product Passport Sheet
 *
 * Seeds product-flavoured objects modelled on real building-component data
 * (translated to English) — a window frame and a ceramic toilet bowl. Asserts
 * that the standalone Product Passport sheet, opened from the objects table
 * row dropdown, surfaces the right hero, lifecycle ribbon, and category cards.
 *
 * The passport renders by bucketing properties on their dictionary `category`,
 * so the seed code clicks the autocomplete suggestion (rather than typing
 * free-text) — that's what saves the stable dictionary key to the property.
 */

const runId = Date.now()

interface DictProp {
  /** Dictionary key — used to click the matching suggestion option. */
  key: string
  /** Short prefix typed into the combobox to surface the suggestion. */
  query: string
  /** Property value the user enters in the value field. */
  value: string
}

/**
 * Add one dictionary-backed property to the open create-object sheet.
 *
 * Selector strategy:
 *  - `[data-testid^="property-item-"]`.last() — scopes to the property card
 *    that was just added (each card has a stable testid of the form
 *    `property-item-new-<n>`).
 *  - Inside that card, the input is found by its placeholder. Using the
 *    "property-name-" testid prefix is unsafe because it also matches the
 *    suggestion listbox and each suggestion <li>.
 */
async function addDictProp(
  page: Page,
  sheet: Locator,
  prop: DictProp,
  index: number
) {
  if (index === 0) {
    await sheet
      .getByRole('button', { name: 'Add Property', exact: true })
      .click()
  } else {
    const addBtn = sheet.getByRole('button', {
      name: 'Add Another Property',
      exact: true,
    })
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.click()
  }

  const item = sheet.locator('[data-testid^="property-item-"]').last()
  await expect(item).toBeVisible({ timeout: 5000 })

  const nameInput = item.getByPlaceholder('e.g. Total Floors')
  await nameInput.click()
  await nameInput.fill(prop.query)

  // Wait for the autocomplete listbox to render the matching suggestion.
  const suggestion = page.locator(
    `[data-testid="property-name-suggestion-${prop.key}"]`
  )
  await expect(suggestion).toBeVisible({ timeout: 5000 })
  await suggestion.click()

  // After accepting, the input shows the localized label — confirm we have
  // a non-empty value before moving on, otherwise the Create-button submit
  // will leave the property keyless and the form will silently drop it.
  await expect(nameInput).not.toHaveValue('')

  // The placeholder switches to a smart hint once an autocomplete suggestion
  // is accepted (e.g. "Total Floors" → "e.g. 5"). Use the stable testid
  // instead of getByPlaceholder.
  await item
    .locator('[data-testid^="property-value-input-"]')
    .first()
    .fill(prop.value)
}

async function createPassportObject(
  page: Page,
  name: string,
  abbreviation: string,
  description: string,
  props: DictProp[]
) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })

  await sheet.getByLabel('Name').fill(name)
  await sheet.getByLabel('Abbreviation').fill(abbreviation)
  await sheet.getByLabel('Description').fill(description)

  for (let i = 0; i < props.length; i++) {
    await addDictProp(page, sheet, props[i], i)
  }

  // Sanity-check: every property card has a non-empty value before submit.
  // Catches form-state desync where a suggestion click didn't propagate.
  const items = sheet.locator('[data-testid^="property-item-"]')
  await expect(items).toHaveCount(props.length)

  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 30000 })
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
}

/**
 * Open the passport for an object by name via the table row dropdown.
 */
async function openPassportFor(page: Page, name: string) {
  const row = page.getByRole('row', { name: new RegExp(name) }).first()
  await expect(row).toBeVisible({ timeout: 10000 })

  await row.locator('[data-testid="object-actions-dropdown"]').click()
  await page.locator('[data-testid="object-action-view-passport"]').click()

  const passportSheet = page.locator('[data-testid="product-passport-sheet"]')
  await expect(passportSheet).toBeVisible({ timeout: 5000 })
  return passportSheet
}

async function closePassport(page: Page) {
  await page.keyboard.press('Escape')
  await expect(
    page.locator('[data-testid="product-passport-sheet"]')
  ).toBeHidden({ timeout: 3000 })
}

test.describe('18 - Product Passport Sheet', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('renders a rich passport for a window frame with active warranty', async ({
    page,
  }) => {
    const name = `TC-PASSPORT Window Frame ${runId}`

    // Window frame modelled on the Cirdax sample (Reynaers steel frame,
    // 1584 x 1624 mm, warranty in the future so the ribbon shows "Active").
    // Comprehensive seed — every major dictionary category is exercised so
    // the passport renders a card for product / classification / dimensions /
    // composition / appearance / sustainability / commerce / ownership /
    // state / contact, plus a full lifecycle ribbon. Use this fixture when
    // iterating on passport UI density.
    const props: DictProp[] = [
      // Product card — manufacturer + supply chain
      { key: 'manufacturer', query: 'manufa', value: 'Reynaers Aluminium' },
      { key: 'supplier', query: 'suppli', value: 'BouwMetaal Rotterdam B.V.' },
      { key: 'country-of-origin', query: 'country', value: 'Belgium' },
      { key: 'model', query: 'model', value: 'CS 77' },
      { key: 'serial-number', query: 'serial', value: 'WF-1584-1624-001' },
      { key: 'product-code', query: 'product-c', value: 'CS77-1584x1624-WHT' },
      { key: 'barcode', query: 'barcode', value: '5400938012345' },
      { key: 'batch-number', query: 'batch', value: 'BN-2020-04-Q2-117' },
      { key: 'category', query: 'categ', value: 'Window frames' },

      // Classification
      { key: 'ifc-class', query: 'ifc', value: 'IfcWindow' },
      { key: 'nl-sfb-classification', query: 'nl-sfb', value: '31.21' },
      { key: 'fire-rating', query: 'fire', value: 'EI 30' },

      // Dimensions
      { key: 'height', query: 'height', value: '1624 mm' },
      { key: 'width', query: 'width', value: '1584 mm' },
      { key: 'depth', query: 'depth', value: '77 mm' },
      { key: 'thickness', query: 'thickn', value: '4 mm' },
      { key: 'weight', query: 'weigh', value: '68 kg' },
      { key: 'area', query: 'area', value: '2.57 m²' },
      { key: 'quantity', query: 'quantit', value: '1' },

      // Composition + appearance
      { key: 'material', query: 'materi', value: 'Steel, double-glazed glass' },
      { key: 'color', query: 'color', value: 'White (RAL 9010)' },
      { key: 'finish', query: 'finish', value: 'Powder-coated matte' },

      // Sustainability
      { key: 'co2-equivalent', query: 'co2', value: '180 kg' },
      { key: 'energy-label', query: 'energy', value: 'A+' },
      { key: 'recycled-content', query: 'recycled-c', value: '62%' },
      {
        key: 'recyclability',
        query: 'recyclab',
        value: 'High — fully separable',
      },
      {
        key: 'certification',
        query: 'certif',
        value: 'Cradle to Cradle Bronze',
      },
      {
        key: 'epd-url',
        query: 'epd',
        value: 'https://www.reynaers.com/epd/cs77.pdf',
      },

      // Commerce
      { key: 'price', query: 'price', value: '1280' },
      { key: 'currency', query: 'currenc', value: 'EUR' },

      // Ownership + responsibility + state
      { key: 'owner', query: 'owner', value: 'Building Operations BV' },
      {
        key: 'responsible',
        query: 'respons',
        value: 'Facility Manager — J. de Vries',
      },
      { key: 'status', query: 'status', value: 'Operational' },

      // Contact
      { key: 'email', query: 'email', value: 'service@reynaers.com' },
      { key: 'phone', query: 'phone', value: '+31 20 555 0142' },
      { key: 'website', query: 'website', value: 'https://www.reynaers.com' },

      // Lifecycle (drives ribbon + warranty progress bar)
      { key: 'production-date', query: 'produ', value: '2020-04-12' },
      { key: 'installation-date', query: 'instal', value: '2020-06-01' },
      { key: 'warranty-end', query: 'warran', value: '2035-06-01' },
      { key: 'last-inspection', query: 'last', value: '2024-09-15' },
      { key: 'next-maintenance', query: 'next-m', value: '2099-01-01' },
      { key: 'lifespan-years', query: 'lifespan', value: '40' },

      // Location — site, indoor placement, geo, map link.
      { key: 'building', query: 'buildi', value: 'Hoofdkantoor — North Wing' },
      { key: 'floor', query: 'floor', value: 'Ground' },
      { key: 'room', query: 'room', value: 'Lobby West' },
      {
        key: 'address',
        query: 'addres',
        value: 'Herengracht 182, 1016 BR Amsterdam',
      },
      { key: 'latitude', query: 'latitu', value: '52.371807' },
      { key: 'longitude', query: 'longit', value: '4.886114' },
      { key: 'coordinates', query: 'coordi', value: '52.371807, 4.886114' },
      {
        key: 'map-url',
        query: 'map',
        value: 'https://maps.google.com/?q=52.371807,4.886114',
      },

      // Documentation — datasheet + manual links surface in the meta card.
      {
        key: 'datasheet-url',
        query: 'datash',
        value: 'https://www.reynaers.com/datasheets/cs77.pdf',
      },
      {
        key: 'manual-url',
        query: 'manual',
        value: 'https://www.reynaers.com/manuals/cs77-installation.pdf',
      },
      {
        key: 'notes',
        query: 'notes',
        value:
          'West façade — exposed to prevailing winds, inspect seals annually.',
      },
    ]

    await createPassportObject(
      page,
      name,
      'WF',
      'Steel window frame, 1584 x 1624 mm — ground floor west façade',
      props
    )

    const passport = await openPassportFor(page, name)

    // Hero — name, abbreviation badge, manufacturer, serial.
    await expect(
      passport.locator('[data-testid="passport-hero"]')
    ).toContainText(name)
    await expect(
      passport.locator('[data-testid="passport-hero"]')
    ).toContainText('WF')
    await expect(
      passport.locator('[data-testid="passport-hero"]')
    ).toContainText('Reynaers Aluminium')
    await expect(
      passport.locator('[data-testid="passport-hero"]')
    ).toContainText('WF-1584-1624-001')

    // Lifecycle ribbon + active warranty.
    const ribbon = passport.locator('[data-testid="passport-lifecycle-ribbon"]')
    await expect(ribbon).toBeVisible()
    await expect(
      ribbon.locator('[data-testid="passport-warranty"]')
    ).toBeVisible()
    await expect(
      ribbon.locator('[data-testid="passport-warranty-progress"]')
    ).toBeVisible()
    await expect(ribbon.getByText(/active/i).first()).toBeVisible()
    await expect(ribbon.getByText(/expired/i)).toHaveCount(0)

    // Category cards — one representative card from each major bucket.
    await expect(
      passport.locator('[data-testid="passport-card-product"]')
    ).toBeVisible()
    await expect(
      passport.locator('[data-testid="passport-card-dimensions"]')
    ).toBeVisible()
    await expect(
      passport.locator('[data-testid="passport-card-sustainability"]')
    ).toBeVisible()
    await expect(
      passport.locator('[data-testid="passport-card-state"]')
    ).toBeVisible()

    // Spot-check that the value text actually flows into the right card.
    await expect(
      passport.locator('[data-testid="passport-card-dimensions"]')
    ).toContainText('1584 mm')
    await expect(
      passport.locator('[data-testid="passport-card-sustainability"]')
    ).toContainText('A+')

    // URL fields render as clickable external links — the dictionary keys
    // ending in "-url" plus "website" must surface as <a target="_blank">.
    const datasheetLink = passport.locator(
      'a[href="https://www.reynaers.com/datasheets/cs77.pdf"]'
    )
    await expect(datasheetLink).toBeVisible()
    await expect(datasheetLink).toHaveAttribute('target', '_blank')
    await expect(datasheetLink).toHaveAttribute('rel', /noopener/)
    // Link label is the cleaned host, not the raw URL — strips
    // "https://www." and trailing slash so it doesn't duplicate the dt.
    await expect(datasheetLink).toContainText(
      'reynaers.com/datasheets/cs77.pdf'
    )

    const websiteLink = passport.locator('a[href="https://www.reynaers.com"]')
    await expect(websiteLink).toBeVisible()

    // Energy-label badge: A+ value gets the EU emerald palette class.
    const sustainabilityCard = passport.locator(
      '[data-testid="passport-card-sustainability"]'
    )
    await expect(sustainabilityCard.locator('text=A+').first()).toBeVisible()

    // Status badge — "Operational" should render as a colored Badge inside
    // the hero (not as a plain dt/dd row in a card).
    const hero = passport.locator('[data-testid="passport-hero"]')
    await expect(hero).toContainText('Operational')

    // Color swatch — color value is rendered with a small dot before the
    // text. Checking the value is in the appearance card is enough; the
    // swatch itself is aria-hidden so we don't assert on it directly.
    await expect(
      passport.locator('[data-testid="passport-card-appearance"]')
    ).toContainText('White (RAL 9010)')

    // Hero shows the branded QR pointing back at this object.
    const qr = passport.locator('[data-testid="passport-qr"]')
    await expect(qr).toBeVisible()
    // qr-code-styling renders into the container; assert it has child nodes
    // (svg or canvas — we don't care which, just that something rendered).
    await expect(qr.locator('svg, canvas')).toHaveCount(1)

    // Footer has both Close and Print. Print opens a new tab to the
    // dedicated print route.
    await expect(
      passport.locator('[data-testid="passport-close-button"]')
    ).toBeVisible()
    const printButton = passport.locator(
      '[data-testid="passport-print-button"]'
    )
    await expect(printButton).toBeVisible()

    // Capture the new tab opened by window.open. Stub window.print on the
    // child page before the auto-print fires to avoid the print dialog.
    const context = page.context()
    await context.addInitScript(() => {
      window.print = () => undefined
    })
    const [printPage] = await Promise.all([
      context.waitForEvent('page'),
      printButton.click(),
    ])
    await printPage.waitForLoadState('domcontentloaded')
    expect(printPage.url()).toContain('/passport/print')
    // Header chrome is hidden in print but still in the DOM; the print
    // page should still render the passport content.
    await expect(
      printPage.locator('[data-testid="passport-hero"]')
    ).toBeVisible({ timeout: 10000 })
    await printPage.close()

    // Close via the footer button — verifies the explicit close path,
    // not just Escape.
    await passport.locator('[data-testid="passport-close-button"]').click()
    await expect(passport).toBeHidden({ timeout: 3000 })
  })

  test('flags an expired warranty for an out-of-service toilet bowl', async ({
    page,
  }) => {
    const name = `TC-PASSPORT Toilet ${runId}`

    // Ceramic wall-hung toilet modelled on the Cirdax sanitary entry:
    // ~400 x 430 x 370 mm, warranty long expired so the destructive badge
    // renders. Fixed past dates keep the assertion stable forever. Same
    // breadth of dictionary categories as the window-frame seed so both
    // passports stress every card with realistic content.
    const props: DictProp[] = [
      // Product + supply chain
      { key: 'manufacturer', query: 'manufa', value: 'Geberit' },
      {
        key: 'supplier',
        query: 'suppli',
        value: 'Sanitair Groothandel Amsterdam',
      },
      { key: 'country-of-origin', query: 'country', value: 'Switzerland' },
      { key: 'model', query: 'model', value: 'iCon' },
      { key: 'serial-number', query: 'serial', value: 'TB-OLD-001' },
      { key: 'product-code', query: 'product-c', value: '500.378.01.1' },
      { key: 'barcode', query: 'barcode', value: '7612101186403' },
      { key: 'batch-number', query: 'batch', value: 'BN-2005-01-A-042' },
      { key: 'category', query: 'categ', value: 'Sanitary' },

      // Classification
      { key: 'ifc-class', query: 'ifc', value: 'IfcSanitaryTerminal' },
      { key: 'nl-sfb-classification', query: 'nl-sfb', value: '74.21' },

      // Dimensions
      { key: 'height', query: 'height', value: '400 mm' },
      { key: 'width', query: 'width', value: '370 mm' },
      { key: 'length', query: 'length', value: '430 mm' },
      { key: 'weight', query: 'weigh', value: '24 kg' },
      { key: 'volume', query: 'volume', value: '6 L' },

      // Composition + appearance
      { key: 'material', query: 'materi', value: 'Ceramic' },
      { key: 'color', query: 'color', value: 'White (Alpine)' },
      { key: 'finish', query: 'finish', value: 'Glazed glossy' },

      // Sustainability
      { key: 'co2-equivalent', query: 'co2', value: '52 kg' },
      { key: 'energy-label', query: 'energy', value: 'B' },
      {
        key: 'recyclability',
        query: 'recyclab',
        value: 'Medium — ceramic recyclable',
      },
      { key: 'certification', query: 'certif', value: 'WaterSense' },

      // Commerce
      { key: 'price', query: 'price', value: '420' },
      { key: 'currency', query: 'currenc', value: 'EUR' },

      // Ownership + state
      { key: 'owner', query: 'owner', value: 'Building Operations BV' },
      {
        key: 'responsible',
        query: 'respons',
        value: 'Facility Manager — J. de Vries',
      },
      { key: 'status', query: 'status', value: 'Decommissioned' },

      // Contact
      { key: 'email', query: 'email', value: 'support@geberit.com' },
      { key: 'phone', query: 'phone', value: '+31 30 232 0010' },
      { key: 'website', query: 'website', value: 'https://www.geberit.nl' },

      // Lifecycle (warranty long expired → destructive badge)
      { key: 'production-date', query: 'produ', value: '2005-01-01' },
      { key: 'installation-date', query: 'instal', value: '2005-03-15' },
      { key: 'warranty-end', query: 'warran', value: '2010-12-31' },
      { key: 'last-inspection', query: 'last', value: '2022-04-10' },
      { key: 'lifespan-years', query: 'lifespan', value: '20' },

      // Location — building, indoor placement, geo, map link.
      { key: 'building', query: 'buildi', value: 'Hoofdkantoor — South Wing' },
      { key: 'floor', query: 'floor', value: '2' },
      { key: 'room', query: 'room', value: 'Restroom 2.04' },
      {
        key: 'address',
        query: 'addres',
        value: 'Herengracht 182, 1016 BR Amsterdam',
      },
      { key: 'latitude', query: 'latitu', value: '52.371807' },
      { key: 'longitude', query: 'longit', value: '4.886114' },
      { key: 'coordinates', query: 'coordi', value: '52.371807, 4.886114' },
      {
        key: 'map-url',
        query: 'map',
        value: 'https://maps.google.com/?q=52.371807,4.886114',
      },

      // Documentation
      {
        key: 'datasheet-url',
        query: 'datash',
        value: 'https://www.geberit.com/datasheets/icon-toilet.pdf',
      },
      {
        key: 'manual-url',
        query: 'manual',
        value: 'https://www.geberit.com/manuals/icon-installation.pdf',
      },
      {
        key: 'notes',
        query: 'notes',
        value: 'Scheduled for replacement during 2026 sanitary refit.',
      },
    ]

    await createPassportObject(
      page,
      name,
      'TB',
      'Wall-hung ceramic toilet bowl — out of warranty',
      props
    )

    const passport = await openPassportFor(page, name)
    const ribbon = passport.locator('[data-testid="passport-lifecycle-ribbon"]')
    await expect(ribbon.getByText(/expired/i).first()).toBeVisible()
    await expect(
      passport.locator('[data-testid="passport-card-composition"]')
    ).toContainText('Ceramic')

    // Decommissioned status — confirms the loose status matcher classifies
    // this value into the zinc/inactive palette (rendered in the hero, not
    // as a category card).
    await expect(
      passport.locator('[data-testid="passport-hero"]')
    ).toContainText('Decommissioned')

    // Manual link should be a clickable anchor.
    const manualLink = passport.locator(
      'a[href="https://www.geberit.com/manuals/icon-installation.pdf"]'
    )
    await expect(manualLink).toBeVisible()
    await expect(manualLink).toHaveAttribute('target', '_blank')

    await closePassport(page)
  })

  test('shows the empty state for an object with no passport data', async ({
    page,
  }) => {
    const name = `TC-PASSPORT Empty ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })
    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })

    await openPassportFor(page, name)
    await expect(page.locator('[data-testid="passport-empty"]')).toBeVisible({
      timeout: 5000,
    })

    await closePassport(page)
  })
})
