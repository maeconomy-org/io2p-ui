export type PropertyDictionaryLocale = 'en' | 'nl'

export interface PropertyDictionaryEntry {
  /** Stable, lowercase-kebab English-rooted identifier — used as Property.key. */
  key: string
  labels: Record<PropertyDictionaryLocale, string>
  aliases?: Partial<Record<PropertyDictionaryLocale, string[]>>
  category?: string
  /**
   * Optional placeholder shown in the value `<Input>` when this property is
   * picked. Suggestive only — the field still accepts any string.
   * Omit for free-text keys (name, description, notes, material…).
   */
  valuePlaceholder?: Record<PropertyDictionaryLocale, string>
}

export const PROPERTY_DICTIONARY: PropertyDictionaryEntry[] = [
  {
    key: 'address',
    labels: { en: 'Address', nl: 'Adres' },
    aliases: { en: ['location'], nl: ['locatie'] },
    category: 'location',
  },
  {
    key: 'street',
    labels: { en: 'Street', nl: 'Straat' },
    aliases: { en: ['street-name'], nl: ['straatnaam'] },
    category: 'location',
  },
  {
    key: 'house-number',
    labels: { en: 'House Number', nl: 'Huisnummer' },
    aliases: { en: ['number', 'street-number'], nl: ['nummer'] },
    category: 'location',
  },
  {
    key: 'city',
    labels: { en: 'City', nl: 'Stad' },
    aliases: { nl: ['plaats', 'gemeente'] },
    category: 'location',
  },
  {
    key: 'postal-code',
    labels: { en: 'Postal Code', nl: 'Postcode' },
    aliases: { en: ['zip', 'zipcode', 'zip-code'] },
    category: 'location',
    valuePlaceholder: { en: '1234 AB', nl: '1234 AB' },
  },
  {
    key: 'state',
    labels: { en: 'State', nl: 'Provincie' },
    aliases: { en: ['province', 'region'], nl: ['regio'] },
    category: 'location',
  },
  {
    key: 'country',
    labels: { en: 'Country', nl: 'Land' },
    category: 'location',
    valuePlaceholder: { en: 'NL', nl: 'NL' },
  },
  {
    key: 'coordinates',
    labels: { en: 'Coordinates', nl: 'Coördinaten' },
    aliases: { en: ['latlng', 'gps', 'lat-lng'], nl: ['gps'] },
    category: 'location',
    valuePlaceholder: { en: '52.3676, 4.9041', nl: '52.3676, 4.9041' },
  },
  {
    key: 'latitude',
    labels: { en: 'Latitude', nl: 'Breedtegraad' },
    aliases: { en: ['lat'] },
    category: 'location',
    valuePlaceholder: { en: '52.3676', nl: '52.3676' },
  },
  {
    key: 'longitude',
    labels: { en: 'Longitude', nl: 'Lengtegraad' },
    aliases: { en: ['lng', 'lon'] },
    category: 'location',
    valuePlaceholder: { en: '4.9041', nl: '4.9041' },
  },
  {
    key: 'nl-sfb-classification',
    labels: { en: 'NL-SfB Classification', nl: 'NL-SfB Classificatie' },
    aliases: { en: ['nls', 'nlsfb', 'sfb'], nl: ['nls', 'nlsfb', 'sfb'] },
    category: 'classification',
    valuePlaceholder: { en: '21.22', nl: '21.22' },
  },
  {
    key: 'ifc-class',
    labels: { en: 'IFC Class', nl: 'IFC Klasse' },
    aliases: { en: ['ifc'], nl: ['ifc'] },
    category: 'classification',
    valuePlaceholder: { en: 'IfcWall', nl: 'IfcWall' },
  },
  {
    key: 'material',
    labels: { en: 'Material', nl: 'Materiaal' },
    category: 'composition',
  },
  {
    key: 'manufacturer',
    labels: { en: 'Manufacturer', nl: 'Fabrikant' },
    category: 'product',
  },
  {
    key: 'product-code',
    labels: { en: 'Product Code', nl: 'Productcode' },
    aliases: { en: ['sku', 'article-number'], nl: ['artikelnummer'] },
    category: 'product',
    valuePlaceholder: { en: 'ABC-123', nl: 'ABC-123' },
  },
  {
    key: 'serial-number',
    labels: { en: 'Serial Number', nl: 'Serienummer' },
    category: 'product',
    valuePlaceholder: { en: 'SN-000123', nl: 'SN-000123' },
  },
  {
    key: 'weight',
    labels: { en: 'Weight', nl: 'Gewicht' },
    category: 'dimensions',
    valuePlaceholder: { en: '12.5 kg', nl: '12,5 kg' },
  },
  {
    key: 'height',
    labels: { en: 'Height', nl: 'Hoogte' },
    category: 'dimensions',
    valuePlaceholder: { en: '100 mm', nl: '100 mm' },
  },
  {
    key: 'width',
    labels: { en: 'Width', nl: 'Breedte' },
    category: 'dimensions',
    valuePlaceholder: { en: '100 mm', nl: '100 mm' },
  },
  {
    key: 'length',
    labels: { en: 'Length', nl: 'Lengte' },
    category: 'dimensions',
    valuePlaceholder: { en: '100 mm', nl: '100 mm' },
  },
  {
    key: 'volume',
    labels: { en: 'Volume', nl: 'Volume' },
    category: 'dimensions',
    valuePlaceholder: { en: '1.5 m3', nl: '1,5 m3' },
  },
  {
    key: 'area',
    labels: { en: 'Area', nl: 'Oppervlakte' },
    category: 'dimensions',
    valuePlaceholder: { en: '25 m2', nl: '25 m2' },
  },
  {
    key: 'quantity',
    labels: { en: 'Quantity', nl: 'Aantal' },
    aliases: { en: ['count', 'amount'], nl: ['hoeveelheid'] },
    category: 'dimensions',
    valuePlaceholder: { en: '10', nl: '10' },
  },
  {
    key: 'color',
    labels: { en: 'Color', nl: 'Kleur' },
    aliases: { en: ['colour'] },
    category: 'appearance',
  },
  {
    key: 'installation-date',
    labels: { en: 'Installation Date', nl: 'Installatiedatum' },
    category: 'lifecycle',
    valuePlaceholder: { en: '2024-01-15', nl: '15-01-2024' },
  },
  {
    key: 'production-date',
    labels: { en: 'Production Date', nl: 'Productiedatum' },
    category: 'lifecycle',
    valuePlaceholder: { en: '2024-01-15', nl: '15-01-2024' },
  },
  {
    key: 'warranty-end',
    labels: { en: 'Warranty End', nl: 'Einde Garantie' },
    aliases: { en: ['warranty'], nl: ['garantie'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '2026-12-31', nl: '31-12-2026' },
  },
  {
    key: 'status',
    labels: { en: 'Status', nl: 'Status' },
    category: 'state',
  },
  {
    key: 'owner',
    labels: { en: 'Owner', nl: 'Eigenaar' },
    category: 'ownership',
  },
  {
    key: 'responsible',
    labels: { en: 'Responsible', nl: 'Verantwoordelijke' },
    category: 'ownership',
  },
  {
    key: 'notes',
    labels: { en: 'Notes', nl: 'Notities' },
    aliases: { en: ['remarks', 'comments'], nl: ['opmerkingen'] },
    category: 'meta',
  },
  {
    key: 'description',
    labels: { en: 'Description', nl: 'Beschrijving' },
    aliases: { en: ['desc', 'info'] },
    category: 'meta',
  },
  {
    key: 'name',
    labels: { en: 'Name', nl: 'Naam' },
    aliases: { en: ['title'], nl: ['titel'] },
    category: 'meta',
  },
  {
    key: 'category',
    labels: { en: 'Category', nl: 'Categorie' },
    aliases: { en: ['type'], nl: ['soort', 'type'] },
    category: 'meta',
  },
  {
    key: 'model',
    labels: { en: 'Model', nl: 'Model' },
    category: 'product',
  },
  {
    key: 'barcode',
    labels: { en: 'Barcode', nl: 'Barcode' },
    aliases: { en: ['ean', 'upc', 'gtin'] },
    category: 'product',
    valuePlaceholder: { en: '5012345678900', nl: '5012345678900' },
  },
  {
    key: 'email',
    labels: { en: 'Email', nl: 'E-mail' },
    aliases: { en: ['e-mail', 'mail'], nl: ['mail'] },
    category: 'contact',
    valuePlaceholder: { en: 'name@example.com', nl: 'naam@voorbeeld.nl' },
  },
  {
    key: 'phone',
    labels: { en: 'Phone', nl: 'Telefoon' },
    aliases: { en: ['telephone', 'tel', 'mobile'], nl: ['tel', 'mobiel'] },
    category: 'contact',
    valuePlaceholder: { en: '+31 6 12 34 56 78', nl: '+31 6 12 34 56 78' },
  },
  {
    key: 'website',
    labels: { en: 'Website', nl: 'Website' },
    aliases: { en: ['url', 'link'] },
    category: 'contact',
    valuePlaceholder: { en: 'https://example.com', nl: 'https://voorbeeld.nl' },
  },
  {
    key: 'price',
    labels: { en: 'Price', nl: 'Prijs' },
    aliases: { en: ['cost'], nl: ['kosten'] },
    category: 'commerce',
    valuePlaceholder: { en: '99.95', nl: '99,95' },
  },
  {
    key: 'currency',
    labels: { en: 'Currency', nl: 'Valuta' },
    category: 'commerce',
    valuePlaceholder: { en: 'EUR', nl: 'EUR' },
  },
  {
    key: 'unit',
    labels: { en: 'Unit', nl: 'Eenheid' },
    aliases: { en: ['uom', 'unit-of-measure'] },
    category: 'dimensions',
  },
  {
    key: 'diameter',
    labels: { en: 'Diameter', nl: 'Diameter' },
    category: 'dimensions',
    valuePlaceholder: { en: '100 mm', nl: '100 mm' },
  },
  {
    key: 'thickness',
    labels: { en: 'Thickness', nl: 'Dikte' },
    category: 'dimensions',
    valuePlaceholder: { en: '100 mm', nl: '100 mm' },
  },
  {
    key: 'depth',
    labels: { en: 'Depth', nl: 'Diepte' },
    category: 'dimensions',
    valuePlaceholder: { en: '100 mm', nl: '100 mm' },
  },
  {
    key: 'density',
    labels: { en: 'Density', nl: 'Dichtheid' },
    category: 'dimensions',
    valuePlaceholder: { en: '1200 kg/m3', nl: '1200 kg/m3' },
  },
  {
    key: 'co2-equivalent',
    labels: { en: 'CO2 Equivalent', nl: 'CO2-equivalent' },
    aliases: { en: ['carbon-footprint', 'gwp'] },
    category: 'sustainability',
    valuePlaceholder: { en: '2.4 kg CO2e', nl: '2,4 kg CO2e' },
  },
  {
    key: 'recycled-content',
    labels: { en: 'Recycled Content', nl: 'Gerecycled Materiaal' },
    aliases: { en: ['recycled'], nl: ['gerecycled'] },
    category: 'sustainability',
    valuePlaceholder: { en: '35%', nl: '35%' },
  },
  {
    key: 'energy-label',
    labels: { en: 'Energy Label', nl: 'Energielabel' },
    category: 'sustainability',
    valuePlaceholder: { en: 'A++', nl: 'A++' },
  },
  {
    key: 'last-inspection',
    labels: { en: 'Last Inspection', nl: 'Laatste Inspectie' },
    aliases: { en: ['inspection-date'], nl: ['inspectiedatum'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '2024-06-01', nl: '01-06-2024' },
  },
  {
    key: 'next-maintenance',
    labels: { en: 'Next Maintenance', nl: 'Volgend Onderhoud' },
    aliases: { en: ['maintenance-date'], nl: ['onderhoudsdatum'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '2025-06-01', nl: '01-06-2025' },
  },
  {
    key: 'supplier',
    labels: { en: 'Supplier', nl: 'Leverancier' },
    aliases: { en: ['vendor', 'distributor'], nl: ['leverancier'] },
    category: 'product',
  },
  {
    key: 'country-of-origin',
    labels: { en: 'Country of Origin', nl: 'Land van Herkomst' },
    aliases: { en: ['origin', 'made-in'], nl: ['herkomst', 'gemaakt-in'] },
    category: 'product',
  },
  {
    key: 'batch-number',
    labels: { en: 'Batch Number', nl: 'Batchnummer' },
    aliases: { en: ['lot-number'], nl: ['lotnummer'] },
    category: 'product',
    valuePlaceholder: { en: 'LOT-2024-001', nl: 'LOT-2024-001' },
  },
  {
    key: 'certification',
    labels: { en: 'Certification', nl: 'Certificering' },
    aliases: { en: ['certified', 'standard'], nl: ['certificaat'] },
    category: 'sustainability',
  },
  {
    key: 'lifespan-years',
    labels: {
      en: 'Expected Lifespan (years)',
      nl: 'Verwachte Levensduur (jaren)',
    },
    aliases: { en: ['lifespan', 'service-life'], nl: ['levensduur'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '25', nl: '25' },
  },
  {
    key: 'recyclability',
    labels: { en: 'Recyclability', nl: 'Recyclebaarheid' },
    aliases: { en: ['recyclable'], nl: ['recyclebaar'] },
    category: 'sustainability',
    valuePlaceholder: { en: '80%', nl: '80%' },
  },
  {
    key: 'finish',
    labels: { en: 'Finish', nl: 'Afwerking' },
    aliases: { en: ['surface-finish'], nl: ['afwerking'] },
    category: 'appearance',
  },
  {
    key: 'fire-rating',
    labels: { en: 'Fire Rating', nl: 'Brandklasse' },
    aliases: { en: ['fire-class'], nl: ['brandklasse'] },
    category: 'classification',
    valuePlaceholder: { en: 'A1', nl: 'A1' },
  },
  {
    key: 'map-url',
    labels: { en: 'Map URL', nl: 'Kaart-URL' },
    aliases: { en: ['map', 'map-link'], nl: ['kaart'] },
    category: 'location',
    valuePlaceholder: {
      en: 'https://maps.google.com/?q=52.3676,4.9041',
      nl: 'https://maps.google.com/?q=52.3676,4.9041',
    },
  },
  {
    key: 'floor',
    labels: { en: 'Floor', nl: 'Verdieping' },
    aliases: { en: ['level', 'storey'], nl: ['etage'] },
    category: 'location',
    valuePlaceholder: { en: '1', nl: '1' },
  },
  {
    key: 'room',
    labels: { en: 'Room', nl: 'Ruimte' },
    aliases: { en: ['zone', 'space'], nl: ['kamer', 'zone'] },
    category: 'location',
  },
  {
    key: 'building',
    labels: { en: 'Building', nl: 'Gebouw' },
    aliases: { en: ['site'], nl: ['pand'] },
    category: 'location',
  },
  {
    key: 'datasheet-url',
    labels: { en: 'Datasheet URL', nl: 'Datasheet-URL' },
    aliases: { en: ['datasheet', 'spec-sheet'], nl: ['datasheet'] },
    category: 'meta',
    valuePlaceholder: {
      en: 'https://manufacturer.com/datasheet.pdf',
      nl: 'https://fabrikant.nl/datasheet.pdf',
    },
  },
  {
    key: 'manual-url',
    labels: { en: 'Manual URL', nl: 'Handleiding-URL' },
    aliases: { en: ['manual', 'instructions'], nl: ['handleiding'] },
    category: 'meta',
    valuePlaceholder: {
      en: 'https://manufacturer.com/manual.pdf',
      nl: 'https://fabrikant.nl/handleiding.pdf',
    },
  },
  {
    key: 'epd-url',
    labels: { en: 'EPD URL', nl: 'EPD-URL' },
    aliases: { en: ['epd', 'environmental-declaration'], nl: ['epd'] },
    category: 'sustainability',
    valuePlaceholder: {
      en: 'https://environdec.com/epd/000123',
      nl: 'https://environdec.com/epd/000123',
    },
  },
  // ── generic quantities ────────────────────────────────────────────────────
  // Additive by nature, so a rollup rule on one of these sums to something meaningful. That is the
  // curation test for this group: a total must answer a real question ("how much X is in here"),
  // which is why ratings, rates and percentages are deliberately absent.
  {
    key: 'mass',
    labels: { en: 'Mass', nl: 'Massa' },
    category: 'dimensions',
    valuePlaceholder: { en: '12.5 kg', nl: '12,5 kg' },
  },
  {
    key: 'net-weight',
    labels: { en: 'Net Weight', nl: 'Nettogewicht' },
    category: 'dimensions',
    valuePlaceholder: { en: '10 kg', nl: '10 kg' },
  },
  {
    key: 'gross-weight',
    labels: { en: 'Gross Weight', nl: 'Brutogewicht' },
    category: 'dimensions',
    valuePlaceholder: { en: '12 kg', nl: '12 kg' },
  },
  {
    key: 'capacity',
    labels: { en: 'Capacity', nl: 'Capaciteit' },
    aliases: { en: ['max-load'], nl: ['maximale-belasting'] },
    category: 'dimensions',
    valuePlaceholder: { en: '500 l', nl: '500 l' },
  },
  {
    key: 'energy-consumption',
    labels: { en: 'Energy Consumption', nl: 'Energieverbruik' },
    aliases: { en: ['energy', 'consumption'], nl: ['energie', 'verbruik'] },
    category: 'sustainability',
    valuePlaceholder: { en: '1200 kWh', nl: '1200 kWh' },
  },
  {
    key: 'power',
    labels: { en: 'Power', nl: 'Vermogen' },
    aliases: { en: ['wattage'] },
    category: 'dimensions',
    valuePlaceholder: { en: '2400 W', nl: '2400 W' },
  },
  {
    key: 'pressure',
    labels: { en: 'Pressure', nl: 'Druk' },
    category: 'dimensions',
    // `N/mm²` is the structural-engineering spelling of MPa and normalizes to it, so a strength
    // authored either way lands in one bucket.
    valuePlaceholder: { en: '5 bar', nl: '5 bar' },
  },
  {
    key: 'compressive-strength',
    labels: { en: 'Compressive Strength', nl: 'Druksterkte' },
    aliases: { en: ['strength'], nl: ['sterkte'] },
    category: 'dimensions',
    valuePlaceholder: { en: '30 N/mm²', nl: '30 N/mm²' },
  },
  {
    key: 'voltage',
    labels: { en: 'Voltage', nl: 'Spanning' },
    category: 'dimensions',
    valuePlaceholder: { en: '230 V', nl: '230 V' },
  },
  {
    key: 'current',
    labels: { en: 'Current', nl: 'Stroom' },
    aliases: { en: ['amperage'] },
    category: 'dimensions',
    valuePlaceholder: { en: '16 A', nl: '16 A' },
  },
  {
    key: 'charge-capacity',
    labels: { en: 'Charge Capacity', nl: 'Laadcapaciteit' },
    // NOT `capacity`, which already means a VOLUME here ("500 l"). Two keys are two rollup
    // totals and nothing merges them, so reusing the word would split one quantity in half.
    aliases: { en: ['battery-capacity'], nl: ['accucapaciteit'] },
    category: 'dimensions',
    valuePlaceholder: { en: '2000 mAh', nl: '2000 mAh' },
  },
  {
    key: 'piece-count',
    labels: { en: 'Piece Count', nl: 'Aantal Stuks' },
    // `count` is its own dimension in the node's table, NOT an alias into unitless — so "5" and
    // "5 pcs" are different kinds and do not sum together.
    aliases: { en: ['pieces'], nl: ['stuks'] },
    category: 'dimensions',
    valuePlaceholder: { en: '12 pcs', nl: '12 pcs' },
  },
  {
    key: 'water-consumption',
    labels: { en: 'Water Consumption', nl: 'Waterverbruik' },
    aliases: { en: ['water'], nl: ['water'] },
    category: 'sustainability',
    valuePlaceholder: { en: '150 l', nl: '150 l' },
  },
  {
    key: 'waste',
    labels: { en: 'Waste', nl: 'Afval' },
    category: 'sustainability',
    valuePlaceholder: { en: '25 kg', nl: '25 kg' },
  },
  {
    key: 'duration',
    labels: { en: 'Duration', nl: 'Duur' },
    aliases: { en: ['time', 'lead-time'], nl: ['tijd', 'doorlooptijd'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '3 d', nl: '3 d' },
  },
  {
    key: 'cost',
    labels: { en: 'Cost', nl: 'Kosten' },
    aliases: { en: ['total-cost'], nl: ['totale-kosten'] },
    category: 'commerce',
    valuePlaceholder: { en: '1250.00', nl: '1250,00' },
  },

  // ── generic identity and process ──────────────────────────────────────────
  {
    key: 'reference',
    labels: { en: 'Reference', nl: 'Referentie' },
    aliases: { en: ['ref', 'reference-number'], nl: ['ref', 'kenmerk'] },
    category: 'meta',
  },
  {
    key: 'version',
    labels: { en: 'Version', nl: 'Versie' },
    aliases: { en: ['revision'], nl: ['revisie'] },
    category: 'meta',
    valuePlaceholder: { en: '1.0', nl: '1.0' },
  },
  {
    key: 'batch-size',
    labels: { en: 'Batch Size', nl: 'Batchgrootte' },
    category: 'dimensions',
    valuePlaceholder: { en: '100', nl: '100' },
  },
  {
    key: 'condition',
    labels: { en: 'Condition', nl: 'Conditie' },
    aliases: { en: ['state'], nl: ['staat', 'toestand'] },
    category: 'state',
  },
  {
    key: 'location',
    labels: { en: 'Location', nl: 'Locatie' },
    // No `plaats` alias: `city` already owns it, and an alias resolving to whichever entry
    // happens to come first is a coin toss the user cannot see.
    aliases: { en: ['position', 'placement'], nl: ['positie'] },
    category: 'location',
  },
  {
    key: 'department',
    labels: { en: 'Department', nl: 'Afdeling' },
    category: 'ownership',
  },
  {
    key: 'project',
    labels: { en: 'Project', nl: 'Project' },
    category: 'meta',
  },
  {
    key: 'start-date',
    labels: { en: 'Start Date', nl: 'Startdatum' },
    category: 'lifecycle',
    valuePlaceholder: { en: '2024-01-15', nl: '15-01-2024' },
  },
  {
    key: 'end-date',
    labels: { en: 'End Date', nl: 'Einddatum' },
    aliases: { en: ['completion-date'], nl: ['opleverdatum'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '2024-06-30', nl: '30-06-2024' },
  },
  {
    key: 'construction-year',
    labels: { en: 'Construction Year', nl: 'Bouwjaar' },
    aliases: { en: ['year-built', 'built'], nl: ['bouwjaar'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '1998', nl: '1998' },
  },
  {
    key: 'comment',
    labels: { en: 'Comment', nl: 'Opmerking' },
    category: 'meta',
  },

  // ── Terms taken from real asset-register sheets (building, estate, hotel, materials) ──────────
  // Scoped area and energy stay SEPARATE keys rather than aliases of `area`/`energy-consumption`:
  // a gross area repeated on every row of a floor would double-count the moment it met a rollup,
  // which is exactly what those sheets do with it.
  {
    key: 'gross-floor-area',
    labels: { en: 'Gross Floor Area', nl: 'Bruto Vloeroppervlak' },
    aliases: { en: ['gfa'], nl: ['bvo'] },
    category: 'dimensions',
    valuePlaceholder: { en: '610 m2', nl: '610 m2' },
  },
  {
    key: 'gross-building-area',
    labels: { en: 'Gross Building Area', nl: 'Bruto Gebouwoppervlak' },
    category: 'dimensions',
    valuePlaceholder: { en: '1780 m2', nl: '1780 m2' },
  },
  {
    key: 'site-area',
    labels: { en: 'Site Area', nl: 'Terreinoppervlak' },
    aliases: { en: ['plot-area'], nl: ['perceeloppervlak'] },
    category: 'dimensions',
    valuePlaceholder: { en: '62000 m2', nl: '62000 m2' },
  },
  {
    key: 'ceiling-height',
    labels: { en: 'Ceiling Height', nl: 'Plafondhoogte' },
    category: 'dimensions',
    valuePlaceholder: { en: '2.7 m', nl: '2,7 m' },
  },
  {
    key: 'floor-energy-consumption',
    labels: {
      en: 'Floor Energy Consumption',
      nl: 'Energieverbruik Verdieping',
    },
    category: 'sustainability',
    valuePlaceholder: { en: '2400 kWh', nl: '2400 kWh' },
  },
  {
    key: 'building-energy-consumption',
    labels: {
      en: 'Building Energy Consumption',
      nl: 'Energieverbruik Gebouw',
    },
    category: 'sustainability',
    valuePlaceholder: { en: '9200 kWh', nl: '9200 kWh' },
  },
  {
    key: 'thermal-conductivity',
    labels: { en: 'Thermal Conductivity', nl: 'Warmtegeleiding' },
    aliases: { en: ['lambda', 'u-value'], nl: ['lambdawaarde'] },
    category: 'sustainability',
    valuePlaceholder: { en: '0.022 W/mK', nl: '0,022 W/mK' },
  },
  {
    key: 'inspection-interval',
    labels: { en: 'Inspection Interval', nl: 'Inspectie-interval' },
    category: 'lifecycle',
    valuePlaceholder: { en: '12 months', nl: '12 maanden' },
  },
  {
    key: 'installed',
    labels: { en: 'Installed', nl: 'Geïnstalleerd' },
    aliases: { en: ['installation-date'], nl: ['installatiedatum'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '2019-03-11', nl: '2019-03-11' },
  },
  {
    key: 'refurbished',
    labels: { en: 'Refurbished', nl: 'Gerenoveerd' },
    aliases: { en: ['renovated'], nl: ['gerenoveerd'] },
    category: 'lifecycle',
    valuePlaceholder: { en: '2019-04-02', nl: '2019-04-02' },
  },
  {
    key: 'cleaning-time',
    labels: { en: 'Cleaning Time', nl: 'Schoonmaaktijd' },
    category: 'dimensions',
    valuePlaceholder: { en: '25 min', nl: '25 min' },
  },
  {
    key: 'occupancy',
    labels: { en: 'Occupancy', nl: 'Bezetting' },
    category: 'dimensions',
    valuePlaceholder: { en: '2', nl: '2' },
  },
  {
    key: 'room-type',
    labels: { en: 'Room Type', nl: 'Ruimtetype' },
    category: 'classification',
    valuePlaceholder: { en: 'Reception', nl: 'Receptie' },
  },
  {
    key: 'asset-type',
    labels: { en: 'Asset Type', nl: 'Objecttype' },
    aliases: { en: ['product-type', 'component-type'], nl: ['producttype'] },
    category: 'classification',
    valuePlaceholder: { en: 'HVAC', nl: 'HVAC' },
  },
  {
    key: 'material-class',
    labels: { en: 'Material Class', nl: 'Materiaalklasse' },
    category: 'classification',
    valuePlaceholder: { en: 'Insulation', nl: 'Isolatie' },
  },
  {
    key: 'fire-class',
    labels: { en: 'Fire Class', nl: 'Brandklasse' },
    aliases: { en: ['euroclass'] },
    category: 'classification',
    valuePlaceholder: { en: 'A1', nl: 'A1' },
  },
  {
    key: 'typical-quantity',
    labels: { en: 'Typical Quantity', nl: 'Typisch Aantal' },
    category: 'meta',
    valuePlaceholder: { en: '4', nl: '4' },
  },
  {
    key: 'hazardous',
    labels: { en: 'Hazardous', nl: 'Gevaarlijk' },
    category: 'state',
    valuePlaceholder: { en: 'No', nl: 'Nee' },
  },
  {
    key: 'orientation',
    labels: { en: 'Orientation', nl: 'Oriëntatie' },
    category: 'location',
    valuePlaceholder: { en: 'South-west', nl: 'Zuidwest' },
  },
  {
    key: 'wall-colour',
    labels: { en: 'Wall Colour', nl: 'Muurkleur' },
    aliases: { en: ['wall-color'] },
    category: 'appearance',
    valuePlaceholder: { en: 'Warm grey', nl: 'Warmgrijs' },
  },
  {
    key: 'nightly-rate',
    labels: { en: 'Nightly Rate', nl: 'Nachttarief' },
    category: 'commerce',
    valuePlaceholder: { en: '95', nl: '95' },
  },
]

const PROPERTY_DICTIONARY_BY_KEY: Map<string, PropertyDictionaryEntry> =
  new Map(PROPERTY_DICTIONARY.map((entry) => [entry.key, entry]))

/**
 * Look up a dictionary entry by its stable key.
 */
export function getDictionaryEntry(
  key: string | undefined | null
): PropertyDictionaryEntry | undefined {
  if (!key) return undefined
  return PROPERTY_DICTIONARY_BY_KEY.get(key)
}

/**
 * Look up an opt-in localized placeholder hint for the value `<Input>`.
 * Returns `undefined` for unknown keys or entries without a hint configured,
 * so callers can fall back to a generic placeholder.
 */
export function getValuePlaceholder(
  key: string | undefined | null,
  locale: PropertyDictionaryLocale
): string | undefined {
  return getDictionaryEntry(key)?.valuePlaceholder?.[locale]
}

/**
 * Resolve a property's display label. If the key matches a dictionary entry,
 * render the localized label; otherwise fall back to the stored label or key.
 */
export function resolvePropertyLabel(
  key: string | undefined,
  storedLabel: string | undefined,
  locale: PropertyDictionaryLocale
): string {
  const entry = getDictionaryEntry(key)
  if (entry) return entry.labels[locale]
  return storedLabel || key || ''
}

const normalize = (s: string) => s.trim().toLowerCase()

/**
 * Letters that survive NFD intact, because they are their own codepoint rather than a base plus a
 * combining mark. Stripping marks turns "\u00f6" into "o" but leaves "\u00df" and "\u00e6" untouched, so without
 * this they fall to the non-ASCII filter and VANISH \u2014 "Gr\u00f6\u00dfe" would key as `gro-e`.
 */
const TRANSLITERATIONS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ł: 'l',
  ħ: 'h',
  ı: 'i',
  '\u00b2': '2',
  '\u00b3': '3',
}

/**
 * Turn typed text into a stable property key.
 *
 * Diacritics are STRIPPED rather than preserved: the node lowercases a key and does nothing else,
 * so "Oppervlakte" and "oppervlákte" would otherwise be two keys for one word, and a rollup rule
 * matching `search.k` exactly would sum only one of them.
 *
 * Returns `''` for input with no ASCII-able characters at all (CJK, emoji). Callers that key data
 * off the result MUST supply their own fallback — an empty key is not storable.
 *
 * Deliberately dictionary-INDEPENDENT. This is the floor that holds however the vocabulary is
 * configured (or removed): two people typing the same word in the same language always get the
 * same key. The dictionary adds cross-language convergence on top; it is not what makes keys agree.
 */
export function slug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, (char) => TRANSLITERATIONS[char] ?? char)
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Find the dictionary entry whose key, label or alias EXACTLY matches the typed text, in either
 * locale. Distinct from `matchDictionary`, which scores prefixes and substrings for the suggestion
 * list — an exact hit is the only kind safe to act on without asking.
 */
export function findExactTerm(
  typed: string
): PropertyDictionaryEntry | undefined {
  const query = normalize(typed)
  if (query === '') return undefined

  // A term's OWN key and labels beat another term's alias. `cost` is an alias of `price` and also a
  // key in its own right; without this order, which one you get depends on array position, and
  // typing the exact name of a term would resolve to something else.
  const direct = PROPERTY_DICTIONARY.find((entry) =>
    [entry.key, entry.labels.en, entry.labels.nl].some(
      (candidate) => normalize(candidate) === query
    )
  )
  if (direct) return direct

  return PROPERTY_DICTIONARY.find((entry) =>
    [...(entry.aliases?.en ?? []), ...(entry.aliases?.nl ?? [])].some(
      (candidate) => normalize(candidate) === query
    )
  )
}

/**
 * Decide what a typed property name is STORED as: a canonical key plus the text as written.
 *
 * The key is identity and the label is language — the protocol keeps them apart, and the free-text
 * path used to store the same string as both. That is what split "Gewicht" from "Weight" into two
 * keys nothing could ever sum together.
 *
 * A term known in EITHER locale resolves to its shared key, so a Dutch author and an English one
 * land on `weight` and their values roll up as one quantity. Anything else is slugged, which is
 * still an improvement (two Dutch users typing "Vloerafwerking" now agree) but cannot bridge
 * languages — no algorithm knows "Vloerafwerking" and "Floor finish" are one concept. That residual
 * is why the dictionary is worth extending.
 *
 * The label is ALWAYS what the user typed. Rewriting visible text under someone is not this
 * function's job — `resolvePropertyLabel` renders a known key in the reader's own language at
 * display time, which gets the same result without touching what was authored.
 */
export function resolveKey(typed: string): { key: string; label: string } {
  const exact = findExactTerm(typed)
  return { key: exact ? exact.key : slug(typed), label: typed }
}

export interface PropertySuggestion {
  entry: PropertyDictionaryEntry
  score: number
  /** The string that matched (localized label) — used to render the suggestion. */
  displayLabel: string
}

/**
 * Score a single candidate string against a normalized query.
 * Prefix match = 3, substring match = 1, no match = 0.
 *
 * Matching runs BOTH ways. A query that merely starts with a term ("Gewicht (kg)", "total weight")
 * used to score zero, because the test only asked whether the term contained the query — so the
 * longer someone typed, the fewer suggestions they got, and the qualified name they were writing
 * became a brand-new key with nothing offered to prevent it. Containing the term scores below
 * being one, so an exact word still wins the list.
 */
function scoreCandidate(candidate: string, query: string): number {
  const c = normalize(candidate)
  if (c === query) return 4
  if (c.startsWith(query)) return 3
  if (c.includes(query)) return 1
  // Guarded by length: a two-letter term appears inside half the sentences anyone could type, and
  // suggesting it on that basis is noise rather than help.
  if (c.length >= 3 && query.startsWith(c)) return 2
  if (c.length >= 4 && query.includes(c)) return 1
  return 0
}

/**
 * Match the query against the dictionary and return top suggestions.
 * Searches labels in both locales and any defined aliases. Scoring prefers
 * prefix matches over substrings; ties broken by shorter label first.
 *
 * Empty or < 2-char queries return an empty list.
 */
export function matchDictionary(
  rawQuery: string,
  locale: PropertyDictionaryLocale,
  limit = 6
): PropertySuggestion[] {
  const query = normalize(rawQuery)
  if (query.length < 2) return []

  const results: PropertySuggestion[] = []

  for (const entry of PROPERTY_DICTIONARY) {
    const candidates: string[] = [
      entry.labels.en,
      entry.labels.nl,
      ...(entry.aliases?.en ?? []),
      ...(entry.aliases?.nl ?? []),
      entry.key,
    ]

    let best = 0
    for (const candidate of candidates) {
      const score = scoreCandidate(candidate, query)
      if (score > best) best = score
      if (best === 3) break
    }

    if (best > 0) {
      results.push({
        entry,
        score: best,
        displayLabel: entry.labels[locale],
      })
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.displayLabel.length - b.displayLabel.length
  })

  return results.slice(0, limit)
}
