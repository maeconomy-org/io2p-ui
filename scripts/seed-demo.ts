/**
 * Seed a demo account with the library data `/import` cannot create.
 *
 * The CSVs in `_DATA/csv` already cover objects, passports and rollup sources. What they cannot
 * carry is anything in the library: constants, formulas, and object/process templates — the
 * importer creates objects only. This fills that half, so a demo can show a formula computing in
 * the write response and a process template describing concrete -> wall -> building.
 *
 * Idempotent by NAME: every create checks the account's existing items first, so a re-run after a
 * partial failure adds only what is missing. Formulas are immutable by design (D-calc), so an
 * existing one is reused rather than edited.
 *
 * Usage:
 *   pnpm seed:demo                      # uses SEED_EMAIL / SEED_PASSWORD, or E2E_* as a fallback
 *   SEED_EMAIL=user@example.com SEED_PASSWORD=... pnpm seed:demo
 */

const AUTH = process.env.SEED_AUTH_URL ?? 'http://localhost:8081'
const CORE = process.env.SEED_CORE_URL ?? 'http://localhost:8080'

const EMAIL = process.env.SEED_EMAIL ?? process.env.E2E_EMAIL
const PASSWORD = process.env.SEED_PASSWORD ?? process.env.E2E_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error(
    'Set SEED_EMAIL and SEED_PASSWORD (or E2E_EMAIL / E2E_PASSWORD) — see scripts/seed-demo.ts'
  )
  process.exit(1)
}

// ── plumbing ─────────────────────────────────────────────────────────────────────

let token = ''

async function signIn(): Promise<void> {
  const res = await fetch(`${AUTH}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    throw new Error(
      `sign-in failed (${res.status}): ${await res.text()}\n` +
        `Does ${EMAIL} exist on ${AUTH}?`
    )
  }
  // better-auth returns the session; the core token is minted from it.
  const cookie = res.headers.get('set-cookie') ?? ''
  const mint = await fetch(`${AUTH}/api/auth/token`, {
    headers: { cookie },
  })
  if (!mint.ok) {
    throw new Error(`token mint failed (${mint.status}): ${await mint.text()}`)
  }
  const body = (await mint.json()) as { token?: string }
  if (!body.token) throw new Error('token mint returned no token')
  token = body.token
}

async function api<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${CORE}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`)
  }
  return (await res.json()) as T
}

interface Paged<T> {
  data: T[]
}
interface Named {
  id: string
  name: string
}

/** Existing items on this account, by name — the basis for idempotency. */
async function byName(path: string): Promise<Map<string, string>> {
  const res = await api<Paged<Named>>('GET', `${path}?page=1&size=100`)
  return new Map(res.data.map((item) => [item.name, item.id]))
}

let created = 0
let reused = 0

async function ensure(
  kind: string,
  existing: Map<string, string>,
  name: string,
  create: () => Promise<Named>
): Promise<string> {
  const found = existing.get(name)
  if (found) {
    reused += 1
    console.log(`  = ${kind} ${name}`)
    return found
  }
  const made = await create()
  existing.set(name, made.id)
  created += 1
  console.log(`  + ${kind} ${name}`)
  return made.id
}

// ── the data ─────────────────────────────────────────────────────────────────────

/** Emission and density factors, the numbers a formula multiplies by. */
const CONSTANTS: { name: string; data: string }[] = [
  { name: 'co2_per_kg_concrete', data: '0.11 kgCO2e' },
  { name: 'co2_per_kg_cement', data: '0.83 kgCO2e' },
  { name: 'co2_per_kg_steel', data: '1.85 kgCO2e' },
  { name: 'co2_per_kg_timber', data: '-1.6 kgCO2e' },
  { name: 'co2_per_kwh_grid', data: '0.31 kgCO2e' },
  // Unitless on purpose: core's unit table holds single dimensions only (`kg`, `m3`), never a
  // compound like `kg/m3`, and a density here is a multiplier the formula applies.
  { name: 'density_concrete', data: '2400' },
  { name: 'density_cement', data: '1440' },
  { name: 'water_per_m3_concrete', data: '150 l' },
]

/**
 * `a + b` and friends stay in the set on purpose: they are the ones to show FIRST, because the
 * mechanism is legible before the units and constants arrive.
 */
const FORMULAS: { name: string; expression: string; unit?: string }[] = [
  { name: 'Sum of two', expression: 'a + b' },
  { name: 'Sum of three', expression: 'a + b + c' },
  { name: 'Difference', expression: 'a - b' },
  { name: 'Area from sides', expression: 'a * b', unit: 'm2' },
  { name: 'Volume from area and height', expression: 'a * b', unit: 'm3' },
  { name: 'Mass from volume and density', expression: 'v * d', unit: 'kg' },
  { name: 'CO2 from mass and factor', expression: 'm * f', unit: 'kgCO2e' },
  { name: 'CO2 from energy', expression: 'e * f', unit: 'kgCO2e' },
  { name: 'Total with waste allowance', expression: 'q * (1 + w)' },
  { name: 'Concrete mix total', expression: 'cement + sand + gravel + water' },
]

/** A product passport: what a real asset register carries per item. */
const PASSPORT_PROPERTIES = [
  { key: 'asset-type', label: 'Asset Type', values: [{ data: 'HVAC' }] },
  { key: 'manufacturer', label: 'Manufacturer', values: [{ data: 'Daikin' }] },
  { key: 'model', label: 'Model', values: [{ data: 'FTXM35R' }] },
  {
    key: 'serial-number',
    label: 'Serial Number',
    values: [{ data: 'SN-000000' }],
  },
  { key: 'barcode', label: 'Barcode', values: [{ data: '8712345678901' }] },
  { key: 'material', label: 'Material', values: [{ data: 'Steel' }] },
  { key: 'weight', label: 'Weight', values: [{ data: '38 kg' }] },
  { key: 'volume', label: 'Volume', values: [{ data: '0.21 m3' }] },
  { key: 'installed', label: 'Installed', values: [{ data: '2024-03-11' }] },
  {
    key: 'warranty-end',
    label: 'Warranty End',
    values: [{ data: '2029-03-11' }],
  },
  {
    key: 'expected-lifespan',
    label: 'Expected Lifespan',
    values: [{ data: '15 years' }],
  },
  {
    key: 'energy-consumption',
    label: 'Energy Consumption',
    values: [{ data: '820 kWh' }],
  },
  {
    key: 'co2-equivalent',
    label: 'CO2 Equivalent',
    values: [{ data: '240 kgCO2e' }],
  },
  { key: 'cost', label: 'Cost', values: [{ data: '1450' }] },
  { key: 'supplier', label: 'Supplier', values: [{ data: 'Klimaat BV' }] },
  {
    key: 'country-of-origin',
    label: 'Country of Origin',
    values: [{ data: 'Netherlands' }],
  },
]

const OBJECT_TEMPLATES = [
  {
    name: 'Product passport',
    description:
      'The per-item fields an asset register carries: identity, provenance, warranty, impact.',
    properties: PASSPORT_PROPERTIES,
  },
  {
    name: 'Building',
    description: 'A site building — envelope figures and the year it went up.',
    properties: [
      {
        key: 'construction-year',
        label: 'Construction Year',
        values: [{ data: '1998' }],
      },
      {
        key: 'gross-building-area',
        label: 'Gross Building Area',
        values: [{ data: '1780 m2' }],
      },
      {
        key: 'energy-consumption',
        label: 'Energy Consumption',
        values: [{ data: '9200 kWh' }],
      },
      {
        key: 'address',
        label: 'Address',
        values: [{ data: 'Keizersgracht 1, Amsterdam' }],
      },
    ],
  },
  {
    name: 'Wall',
    description:
      'A wall built from concrete — the step between material and building.',
    properties: [
      { key: 'material', label: 'Material', values: [{ data: 'Concrete' }] },
      { key: 'area', label: 'Area', values: [{ data: '12 m2' }] },
      { key: 'thickness', label: 'Thickness', values: [{ data: '0.2 m' }] },
      { key: 'volume', label: 'Volume', values: [{ data: '2.4 m3' }] },
      { key: 'weight', label: 'Weight', values: [{ data: '5760 kg' }] },
      { key: 'fire-class', label: 'Fire Class', values: [{ data: 'A1' }] },
    ],
  },
  {
    name: 'Material',
    description:
      'A library material: what it is made of and what it costs the planet.',
    properties: [
      {
        key: 'material-class',
        label: 'Material Class',
        values: [{ data: 'Structural' }],
      },
      { key: 'density', label: 'Density', values: [{ data: '2400' }] },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '0.11 kgCO2e' }],
      },
      {
        key: 'recycled-content',
        label: 'Recycled Content',
        values: [{ data: '12%' }],
      },
      {
        key: 'recyclability',
        label: 'Recyclability',
        values: [{ data: '70%' }],
      },
      {
        key: 'thermal-conductivity',
        label: 'Thermal Conductivity',
        values: [{ data: '1.7' }],
      },
      { key: 'unit', label: 'Unit', values: [{ data: 'm3' }] },
    ],
  },
]

/** in -> out, the chain you asked for: mix -> concrete -> wall -> building. */
const PROCESS_TEMPLATES = [
  {
    name: 'Make concrete',
    description: 'Cement, sand, gravel and water in, concrete out.',
    properties: [
      { key: 'quantity', label: 'Batch Size', values: [{ data: '1 m3' }] },
      {
        key: 'water-consumption',
        label: 'Water Consumption',
        values: [{ data: '150 l' }],
      },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '264 kgCO2e' }],
      },
    ],
    inputs: [
      {
        properties: [
          { key: 'material', label: 'Cement', values: [{ data: '320 kg' }] },
        ],
      },
      {
        properties: [
          { key: 'material', label: 'Sand', values: [{ data: '800 kg' }] },
        ],
      },
      {
        properties: [
          { key: 'material', label: 'Gravel', values: [{ data: '1040 kg' }] },
        ],
      },
      {
        properties: [
          { key: 'material', label: 'Water', values: [{ data: '150 l' }] },
        ],
      },
    ],
    outputs: [
      {
        properties: [
          { key: 'material', label: 'Concrete', values: [{ data: '2310 kg' }] },
        ],
      },
    ],
  },
  {
    name: 'Cast wall',
    description: 'Concrete and rebar in, a finished wall out.',
    properties: [
      { key: 'duration', label: 'Curing Time', values: [{ data: '28 days' }] },
      { key: 'waste', label: 'Waste', values: [{ data: '40 kg' }] },
    ],
    inputs: [
      {
        properties: [
          { key: 'material', label: 'Concrete', values: [{ data: '2400 kg' }] },
        ],
      },
      {
        properties: [
          { key: 'material', label: 'Rebar', values: [{ data: '85 kg' }] },
        ],
      },
    ],
    outputs: [
      {
        properties: [
          { key: 'material', label: 'Wall', values: [{ data: '1 pcs' }] },
        ],
      },
    ],
  },
  {
    name: 'Assemble building',
    description: 'Walls, floors and a roof in, a building out.',
    properties: [
      { key: 'duration', label: 'Build Time', values: [{ data: '180 days' }] },
      { key: 'cost', label: 'Cost', values: [{ data: '1250000' }] },
    ],
    inputs: [
      {
        properties: [
          { key: 'quantity', label: 'Walls', values: [{ data: '124 pcs' }] },
        ],
      },
      {
        properties: [
          { key: 'quantity', label: 'Floors', values: [{ data: '5 pcs' }] },
        ],
      },
      {
        properties: [
          { key: 'quantity', label: 'Roof', values: [{ data: '1 pcs' }] },
        ],
      },
    ],
    outputs: [
      {
        properties: [
          { key: 'quantity', label: 'Building', values: [{ data: '1 pcs' }] },
        ],
      },
    ],
  },
  {
    name: 'Demolish and sort',
    description:
      'The circular end: a building in, sorted material streams out.',
    properties: [
      { key: 'waste', label: 'Residual Waste', values: [{ data: '18000 kg' }] },
    ],
    inputs: [
      {
        properties: [
          { key: 'quantity', label: 'Building', values: [{ data: '1 pcs' }] },
        ],
      },
    ],
    outputs: [
      {
        properties: [
          {
            key: 'material',
            label: 'Concrete rubble',
            values: [{ data: '620000 kg' }],
          },
        ],
      },
      {
        properties: [
          {
            key: 'material',
            label: 'Steel scrap',
            values: [{ data: '48000 kg' }],
          },
        ],
      },
      {
        properties: [
          { key: 'material', label: 'Timber', values: [{ data: '12000 kg' }] },
        ],
      },
    ],
  },
]

/**
 * The materials the process flows bind to, and the parent that holds them.
 *
 * A flow's `ref` is a SUGGESTED default, not a binding: core states it is "NOT existence-checked"
 * (`templates.rules.ts`), and the real objects are still chosen when the template is used. Seeded
 * anyway, because an unbound template renders as "Any object" four times over and shows nothing —
 * with refs the sheet reads Cement, Sand, Gravel, Water -> Concrete.
 *
 * The trade: a ref survives the object being deleted and then points at nothing. Acceptable for
 * demo fixtures, worth knowing before copying this into a shipped template.
 */
const MATERIALS_PARENT = 'Materials'

const MATERIALS: {
  name: string
  density?: string
  co2?: string
  unit: string
}[] = [
  { name: 'Water', unit: 'l' },
  { name: 'Cement', density: '1440', co2: '0.83 kgCO2e', unit: 'kg' },
  { name: 'Sand', density: '1600', co2: '0.01 kgCO2e', unit: 'kg' },
  { name: 'Gravel', density: '1500', co2: '0.01 kgCO2e', unit: 'kg' },
  { name: 'Concrete', density: '2400', co2: '0.11 kgCO2e', unit: 'm3' },
  { name: 'Rebar', density: '7850', co2: '1.85 kgCO2e', unit: 'kg' },
  { name: 'Steel', density: '7850', co2: '1.85 kgCO2e', unit: 'kg' },
  { name: 'Timber', density: '500', co2: '-1.6 kgCO2e', unit: 'm3' },
]

/** Which material each flow slot points at, by template name, in flow order. */
const FLOW_BINDINGS: Record<string, { inputs: string[]; outputs: string[] }> = {
  'Make concrete': {
    inputs: ['Cement', 'Sand', 'Gravel', 'Water'],
    outputs: ['Concrete'],
  },
  'Cast wall': { inputs: ['Concrete', 'Rebar'], outputs: [] },
  'Assemble building': { inputs: ['Concrete', 'Steel', 'Glass'], outputs: [] },
  'Demolish and sort': { inputs: [], outputs: ['Concrete', 'Steel', 'Timber'] },
}

/**
 * What the processes PRODUCE. Core requires at least one input and one output on every process,
 * so a run that makes a wall needs that wall to exist as an object first.
 */
const PRODUCTS: {
  name: string
  properties: { key: string; label: string; values: { data: string }[] }[]
}[] = [
  {
    name: 'Wall A2-14',
    properties: [
      { key: 'material', label: 'Material', values: [{ data: 'Concrete' }] },
      { key: 'area', label: 'Area', values: [{ data: '12 m2' }] },
      { key: 'volume', label: 'Volume', values: [{ data: '2.4 m3' }] },
      { key: 'weight', label: 'Weight', values: [{ data: '5760 kg' }] },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '634 kgCO2e' }],
      },
    ],
  },
  {
    name: 'Facade Block A',
    properties: [
      { key: 'material', label: 'Material', values: [{ data: 'Glass' }] },
      { key: 'area', label: 'Area', values: [{ data: '420 m2' }] },
      { key: 'weight', label: 'Weight', values: [{ data: '9650 kg' }] },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '11800 kgCO2e' }],
      },
    ],
  },
  {
    name: 'Westgate 1974',
    properties: [
      {
        key: 'construction-year',
        label: 'Construction Year',
        values: [{ data: '1974' }],
      },
      {
        key: 'gross-building-area',
        label: 'Gross Building Area',
        values: [{ data: '6200 m2' }],
      },
      { key: 'weight', label: 'Weight', values: [{ data: '689500 kg' }] },
    ],
  },
]

/**
 * Actual process RUNS, not templates.
 *
 * A process flow's `ref` is REQUIRED and existence-checked (`RefInputShape`), unlike the template's
 * suggested default — so these bind to real material objects and are what the Processes view draws
 * its Sankey from. Quantities are per batch and tell one story end to end: raw material in,
 * concrete, a wall, a building, then demolition back to sorted streams.
 */
const PROCESSES: {
  name: string
  description: string
  properties?: { key: string; label: string; values: { data: string }[] }[]
  inputs: { material: string; qty: string }[]
  outputs: { material: string; qty: string }[]
}[] = [
  {
    name: 'Concrete batch C30/37 — 2026-08',
    description: 'One cubic metre of structural concrete, mixed on site.',
    properties: [
      { key: 'quantity', label: 'Batch Size', values: [{ data: '1 m3' }] },
      {
        key: 'water-consumption',
        label: 'Water Consumption',
        values: [{ data: '150 l' }],
      },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '266 kgCO2e' }],
      },
      { key: 'cost', label: 'Cost', values: [{ data: '92' }] },
    ],
    inputs: [
      { material: 'Cement', qty: '320 kg' },
      { material: 'Sand', qty: '800 kg' },
      { material: 'Gravel', qty: '1040 kg' },
      { material: 'Water', qty: '150 l' },
    ],
    outputs: [{ material: 'Concrete', qty: '2310 kg' }],
  },
  {
    name: 'Wall pour — Block A level 2',
    description: 'Reinforced wall cast from the C30/37 batch.',
    properties: [
      { key: 'duration', label: 'Curing Time', values: [{ data: '28 days' }] },
      { key: 'waste', label: 'Waste', values: [{ data: '40 kg' }] },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '421 kgCO2e' }],
      },
    ],
    inputs: [
      { material: 'Concrete', qty: '2400 kg' },
      { material: 'Rebar', qty: '85 kg' },
    ],
    outputs: [{ material: 'Wall A2-14', qty: '1 pcs' }],
  },
  {
    name: 'Facade glazing — Block A',
    description: 'Curtain wall glazing, aluminium framed.',
    properties: [
      { key: 'area', label: 'Area', values: [{ data: '420 m2' }] },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '11800 kgCO2e' }],
      },
    ],
    inputs: [
      { material: 'Glass', qty: '8400 kg' },
      { material: 'Aluminum', qty: '1250 kg' },
    ],
    outputs: [{ material: 'Facade Block A', qty: '1 pcs' }],
  },
  {
    name: 'Demolition sort — Westgate 1974',
    description: 'End of life: a building back into sorted material streams.',
    properties: [
      {
        key: 'waste',
        label: 'Residual Waste',
        values: [{ data: '18000 kg' }],
      },
      {
        key: 'co2-equivalent',
        label: 'CO2 Equivalent',
        values: [{ data: '9400 kgCO2e' }],
      },
    ],
    inputs: [{ material: 'Westgate 1974', qty: '1 pcs' }],
    outputs: [
      { material: 'Concrete', qty: '620000 kg' },
      { material: 'Steel', qty: '48000 kg' },
      { material: 'Wood', qty: '12000 kg' },
      { material: 'Glass', qty: '9500 kg' },
    ],
  },
  {
    name: 'Steel recovery — batch 12',
    description: 'Reclaimed rebar and structural steel back to feedstock.',
    properties: [
      {
        key: 'recycled-content',
        label: 'Recycled Content',
        values: [{ data: '94%' }],
      },
      {
        key: 'energy-consumption',
        label: 'Energy Consumption',
        values: [{ data: '5600 kWh' }],
      },
    ],
    inputs: [
      { material: 'Steel', qty: '48000 kg' },
      { material: 'Rebar', qty: '3200 kg' },
    ],
    outputs: [{ material: 'Steel', qty: '46800 kg' }],
  },
]

/**
 * Rollup rules for the keys the demo CSVs author. Created LAST and deliberately noted: a rule only
 * computes on the next write to a subtree, so rules made after an import show nothing until
 * something below changes. Seed these BEFORE importing a CSV.
 */
const ROLLUP_KEYS = [
  'weight',
  'volume',
  'co2-equivalent',
  'energy-consumption',
  'cost',
  'waste',
  'quantity',
  'water-consumption',
  'area',
]

// ── run ──────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Seeding ${EMAIL} on ${CORE}\n`)
  await signIn()

  console.log('Constants')
  const constants = await byName('/constants')
  const constantIds = new Map<string, string>()
  for (const c of CONSTANTS) {
    const id = await ensure('constant', constants, c.name, () =>
      api<Named>('POST', '/constants', c)
    )
    constantIds.set(c.name, id)
  }

  console.log('\nFormulas')
  const formulas = await byName('/formulas')
  for (const f of FORMULAS) {
    await ensure('formula', formulas, f.name, () =>
      api<Named>('POST', '/formulas', f)
    )
  }

  console.log('\nObject templates')
  const templates = await byName('/templates')
  for (const tpl of OBJECT_TEMPLATES) {
    await ensure('template', templates, tpl.name, () =>
      api<Named>('POST', '/templates', { type: 'object', ...tpl })
    )
  }

  console.log('\nMaterials')
  // `size` is capped at 100 by the node; the demo set is far below it.
  const objects = await byName('/objects')
  const parentId = await ensure('object', objects, MATERIALS_PARENT, () =>
    api<Named>('POST', '/objects', {
      name: MATERIALS_PARENT,
      description: 'Reference materials the process flows draw from.',
    })
  )
  /**
   * PREFER a material that already exists — `materials-library.csv` carries fifteen properties per
   * row where these carry four, so an imported library wins and the create below is only a
   * fallback for an account that has not imported one.
   */
  const materialIds = new Map<string, string>()
  for (const m of MATERIALS) {
    const id = await ensure('object', objects, m.name, () =>
      api<Named>('POST', '/objects', {
        name: m.name,
        parents: [parentId],
        properties: [
          {
            key: 'material-class',
            label: 'Material Class',
            values: [{ data: 'Structural' }],
          },
          ...(m.density
            ? [
                {
                  key: 'density',
                  label: 'Density',
                  values: [{ data: m.density }],
                },
              ]
            : []),
          ...(m.co2
            ? [
                {
                  key: 'co2-equivalent',
                  label: 'CO2 Equivalent',
                  values: [{ data: m.co2 }],
                },
              ]
            : []),
          { key: 'unit', label: 'Unit', values: [{ data: m.unit }] },
        ],
      })
    )
    materialIds.set(m.name, id)
  }

  console.log('\nProcess templates')
  for (const tpl of PROCESS_TEMPLATES) {
    const binding = FLOW_BINDINGS[tpl.name]
    // `ref` binds a flow slot to a real object. Without it every slot reads "Any object", which
    // is a shape with nothing in it — the flows are the point of a process template.
    const bind = (flows: typeof tpl.inputs, names: string[]) =>
      flows.map((flow, i) => {
        const id = names[i] ? materialIds.get(names[i]) : undefined
        return id ? { ...flow, ref: id } : flow
      })

    await ensure('template', templates, tpl.name, () =>
      api<Named>('POST', '/templates', {
        type: 'process',
        ...tpl,
        inputs: bind(tpl.inputs, binding?.inputs ?? []),
        outputs: bind(tpl.outputs, binding?.outputs ?? []),
      })
    )
  }

  console.log('\nProducts')
  // Created at ROOT, not under Materials: these are what the processes make, not stock to draw on.
  for (const prod of PRODUCTS) {
    const id = await ensure('object', objects, prod.name, () =>
      api<Named>('POST', '/objects', {
        name: prod.name,
        properties: prod.properties,
      })
    )
    materialIds.set(prod.name, id)
  }

  console.log('\nProcesses')
  const processes = await byName('/processes')
  for (const proc of PROCESSES) {
    // `objects` is every object on the account, so a material that came from the CSV import
    // resolves as readily as a seeded one — the seed list is only the fallback.
    const flow = (f: { material: string; qty: string }) => {
      const ref = materialIds.get(f.material) ?? objects.get(f.material)
      if (!ref) return undefined
      return {
        ref,
        properties: [
          {
            key: 'quantity',
            label: f.material,
            values: [{ data: f.qty }],
          },
        ],
      }
    }
    const inputs = proc.inputs.map(flow).filter(Boolean)
    const outputs = proc.outputs.map(flow).filter(Boolean)

    // Core requires BOTH directions. A material that resolved to nothing would silently empty a
    // side and produce a 422 naming the direction rather than the missing name.
    const missing = [...proc.inputs, ...proc.outputs]
      .map((f) => f.material)
      .filter((name) => !materialIds.get(name) && !objects.get(name))
    if (missing.length) {
      console.log(
        `  ! ${proc.name} skipped — no object named ${missing.join(', ')}`
      )
      continue
    }

    await ensure('process', processes, proc.name, () =>
      api<Named>('POST', '/processes', {
        name: proc.name,
        description: proc.description,
        properties: proc.properties,
        inputs,
        outputs,
      })
    )
  }

  console.log('\nRollup rules')
  const rules = await api<Paged<{ id: string; propertyKey: string }>>(
    'GET',
    '/rollup-rules?page=1&size=100'
  )
  const haveKeys = new Set(rules.data.map((r) => r.propertyKey))
  const missing = ROLLUP_KEYS.filter((k) => !haveKeys.has(k))
  for (const key of haveKeys) {
    if (ROLLUP_KEYS.includes(key)) {
      reused += 1
      console.log(`  = rule ${key}`)
    }
  }
  // One rule per request: the endpoint takes a single `propertyKey`, and the sheet's "add several
  // keys" is a loop over it rather than a bulk body.
  for (const key of missing) {
    await api('POST', '/rollup-rules', {
      propertyKey: key,
      aggregation: 'sum',
    })
    created += 1
    console.log(`  + rule ${key}`)
  }

  console.log(`\nDone — ${created} created, ${reused} already present.`)
  console.log(
    '\nNext: import a CSV from _DATA/csv (levels mode) and the rules above will total it.\n' +
      'Rules exist BEFORE the import, so the first write computes them.'
  )
}

main().catch((error: unknown) => {
  console.error(`\nFailed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
