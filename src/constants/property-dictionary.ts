export type PropertyDictionaryLocale = 'en' | 'nl'

export interface PropertyDictionaryEntry {
  /** Stable, lowercase-kebab English-rooted identifier — used as Property.key. */
  key: string
  labels: Record<PropertyDictionaryLocale, string>
  aliases?: Partial<Record<PropertyDictionaryLocale, string[]>>
  category?: string
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
  },
  {
    key: 'coordinates',
    labels: { en: 'Coordinates', nl: 'Coördinaten' },
    aliases: { en: ['latlng', 'gps', 'lat-lng'], nl: ['gps'] },
    category: 'location',
  },
  {
    key: 'latitude',
    labels: { en: 'Latitude', nl: 'Breedtegraad' },
    aliases: { en: ['lat'] },
    category: 'location',
  },
  {
    key: 'longitude',
    labels: { en: 'Longitude', nl: 'Lengtegraad' },
    aliases: { en: ['lng', 'lon'] },
    category: 'location',
  },
  {
    key: 'nl-sfb-classification',
    labels: { en: 'NL-SfB Classification', nl: 'NL-SfB Classificatie' },
    aliases: { en: ['nls', 'nlsfb', 'sfb'], nl: ['nls', 'nlsfb', 'sfb'] },
    category: 'classification',
  },
  {
    key: 'ifc-class',
    labels: { en: 'IFC Class', nl: 'IFC Klasse' },
    aliases: { en: ['ifc'], nl: ['ifc'] },
    category: 'classification',
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
  },
  {
    key: 'serial-number',
    labels: { en: 'Serial Number', nl: 'Serienummer' },
    category: 'product',
  },
  {
    key: 'weight',
    labels: { en: 'Weight', nl: 'Gewicht' },
    category: 'dimensions',
  },
  {
    key: 'height',
    labels: { en: 'Height', nl: 'Hoogte' },
    category: 'dimensions',
  },
  {
    key: 'width',
    labels: { en: 'Width', nl: 'Breedte' },
    category: 'dimensions',
  },
  {
    key: 'length',
    labels: { en: 'Length', nl: 'Lengte' },
    category: 'dimensions',
  },
  {
    key: 'volume',
    labels: { en: 'Volume', nl: 'Volume' },
    category: 'dimensions',
  },
  {
    key: 'area',
    labels: { en: 'Area', nl: 'Oppervlakte' },
    category: 'dimensions',
  },
  {
    key: 'quantity',
    labels: { en: 'Quantity', nl: 'Aantal' },
    aliases: { en: ['count', 'amount'], nl: ['hoeveelheid'] },
    category: 'dimensions',
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
  },
  {
    key: 'production-date',
    labels: { en: 'Production Date', nl: 'Productiedatum' },
    category: 'lifecycle',
  },
  {
    key: 'warranty-end',
    labels: { en: 'Warranty End', nl: 'Einde Garantie' },
    aliases: { en: ['warranty'], nl: ['garantie'] },
    category: 'lifecycle',
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
  },
  {
    key: 'email',
    labels: { en: 'Email', nl: 'E-mail' },
    aliases: { en: ['e-mail', 'mail'], nl: ['mail'] },
    category: 'contact',
  },
  {
    key: 'phone',
    labels: { en: 'Phone', nl: 'Telefoon' },
    aliases: { en: ['telephone', 'tel', 'mobile'], nl: ['tel', 'mobiel'] },
    category: 'contact',
  },
  {
    key: 'website',
    labels: { en: 'Website', nl: 'Website' },
    aliases: { en: ['url', 'link'] },
    category: 'contact',
  },
  {
    key: 'price',
    labels: { en: 'Price', nl: 'Prijs' },
    aliases: { en: ['cost'], nl: ['kosten'] },
    category: 'commerce',
  },
  {
    key: 'currency',
    labels: { en: 'Currency', nl: 'Valuta' },
    category: 'commerce',
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
  },
  {
    key: 'thickness',
    labels: { en: 'Thickness', nl: 'Dikte' },
    category: 'dimensions',
  },
  {
    key: 'depth',
    labels: { en: 'Depth', nl: 'Diepte' },
    category: 'dimensions',
  },
  {
    key: 'density',
    labels: { en: 'Density', nl: 'Dichtheid' },
    category: 'dimensions',
  },
  {
    key: 'co2-equivalent',
    labels: { en: 'CO2 Equivalent', nl: 'CO2-equivalent' },
    aliases: { en: ['carbon-footprint', 'gwp'] },
    category: 'sustainability',
  },
  {
    key: 'recycled-content',
    labels: { en: 'Recycled Content', nl: 'Gerecycled Materiaal' },
    aliases: { en: ['recycled'], nl: ['gerecycled'] },
    category: 'sustainability',
  },
  {
    key: 'energy-label',
    labels: { en: 'Energy Label', nl: 'Energielabel' },
    category: 'sustainability',
  },
  {
    key: 'last-inspection',
    labels: { en: 'Last Inspection', nl: 'Laatste Inspectie' },
    aliases: { en: ['inspection-date'], nl: ['inspectiedatum'] },
    category: 'lifecycle',
  },
  {
    key: 'next-maintenance',
    labels: { en: 'Next Maintenance', nl: 'Volgend Onderhoud' },
    aliases: { en: ['maintenance-date'], nl: ['onderhoudsdatum'] },
    category: 'lifecycle',
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
  },
  {
    key: 'recyclability',
    labels: { en: 'Recyclability', nl: 'Recyclebaarheid' },
    aliases: { en: ['recyclable'], nl: ['recyclebaar'] },
    category: 'sustainability',
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
  },
  {
    key: 'map-url',
    labels: { en: 'Map URL', nl: 'Kaart-URL' },
    aliases: { en: ['map', 'map-link'], nl: ['kaart'] },
    category: 'location',
  },
  {
    key: 'floor',
    labels: { en: 'Floor', nl: 'Verdieping' },
    aliases: { en: ['level', 'storey'], nl: ['etage'] },
    category: 'location',
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
  },
  {
    key: 'manual-url',
    labels: { en: 'Manual URL', nl: 'Handleiding-URL' },
    aliases: { en: ['manual', 'instructions'], nl: ['handleiding'] },
    category: 'meta',
  },
  {
    key: 'epd-url',
    labels: { en: 'EPD URL', nl: 'EPD-URL' },
    aliases: { en: ['epd', 'environmental-declaration'], nl: ['epd'] },
    category: 'sustainability',
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

export interface PropertySuggestion {
  entry: PropertyDictionaryEntry
  score: number
  /** The string that matched (localized label) — used to render the suggestion. */
  displayLabel: string
}

/**
 * Score a single candidate string against a normalized query.
 * Prefix match = 3, substring match = 1, no match = 0.
 */
function scoreCandidate(candidate: string, query: string): number {
  const c = normalize(candidate)
  if (c.startsWith(query)) return 3
  if (c.includes(query)) return 1
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
