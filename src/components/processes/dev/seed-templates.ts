/**
 * DEV-ONLY process seed templates.
 *
 * After a DB wipe, object UUIDs change but the dummy materials (imported from the fixed
 * material-data.csv) keep the same NAMES. These templates reference objects by name; the
 * seeder resolves each to its current UUID and creates the process via the normal codec path.
 *
 * Properties below mirror the metadata that used to be hardcoded form fields — Process
 * Category, Flow Type, Carbon Emissions, Material Loss, Quality Change, Notes (process-level)
 * and Lifecycle Stage, Material Category (per input/output) — now expressed as the dynamic
 * properties the new model uses. (Process templates that auto-create these will come with the
 * API rewrite; until then the seed demonstrates the full shape.)
 */

export interface SeedMaterial {
  /** object name — resolved to the current UUID at seed time */
  objectName: string
  /** free-text quantity, parsed like the form (e.g. "100 kg", "30 l", "200 pcs") */
  quantity?: string
  /** label for the quantity property (default "Quantity") */
  quantityLabel?: string
  /** extra non-quantity properties (lifecycle, category, …) */
  properties?: { label: string; value: string }[]
}

export interface ProcessSeedTemplate {
  name: string
  type?: string
  /** process notes — the predefined description field */
  description?: string
  /** process-level (plain) properties */
  properties?: { label: string; value: string }[]
  inputs: SeedMaterial[]
  outputs: SeedMaterial[]
}

// --- helpers to keep templates readable -------------------------------------

/** A material with optional lifecycle stage + material category. */
const mat = (
  objectName: string,
  quantity: string,
  opts?: { lifecycle?: string; category?: string }
): SeedMaterial => ({
  objectName,
  quantity,
  properties: [
    ...(opts?.lifecycle
      ? [{ label: 'Lifecycle Stage', value: opts.lifecycle }]
      : []),
    ...(opts?.category
      ? [{ label: 'Material Category', value: opts.category }]
      : []),
  ],
})

/** Process-level metadata mirroring the old fixed fields. */
const meta = (opts: {
  category: string
  flow: string
  emissions?: string
  loss?: string
  quality?: string
}): { label: string; value: string }[] => [
  { label: 'Process Category', value: opts.category },
  { label: 'Flow Type', value: opts.flow },
  ...(opts.emissions
    ? [{ label: 'Carbon Emissions', value: opts.emissions }]
    : []),
  ...(opts.loss ? [{ label: 'Material Loss', value: opts.loss }] : []),
  ...(opts.quality ? [{ label: 'Quality Change', value: opts.quality }] : []),
]

/**
 * A connected construction graph (raw → Concrete/Mortar → Wall/Window → Floor → Building →
 * Demolition) plus an acyclic recycling flow. Mixed units (kg / l / pcs / m2) exercise the
 * cross-dimension display; rich metadata exercises the details sheet.
 */
export const PROCESS_SEED_TEMPLATES: ProcessSeedTemplate[] = [
  {
    name: 'Concrete Mixing',
    type: 'production',
    description: 'Batch mixing of structural concrete from raw aggregates.',
    properties: meta({
      category: 'Construction',
      flow: 'Standard',
      emissions: '52 kgCO2e',
      loss: '5 %',
      quality: 'Same',
    }),
    inputs: [
      mat('Cement', '50 kg', {
        lifecycle: 'Primary Input',
        category: 'Binder',
      }),
      mat('Water', '30 l', { lifecycle: 'Primary Input' }),
      mat('Sand', '100 kg', {
        lifecycle: 'Primary Input',
        category: 'Aggregate',
      }),
      mat('Gravel', '120 kg', {
        lifecycle: 'Primary Input',
        category: 'Aggregate',
      }),
    ],
    outputs: [
      mat('Concrete', '300 kg', { lifecycle: 'Product', category: 'Concrete' }),
    ],
  },
  {
    name: 'Mortar Mixing',
    type: 'production',
    properties: meta({
      category: 'Construction',
      flow: 'Standard',
      emissions: '18 kgCO2e',
    }),
    inputs: [
      mat('Cement', '20 kg', { category: 'Binder' }),
      mat('Sand', '60 kg', { category: 'Aggregate' }),
      mat('Water', '15 l'),
    ],
    outputs: [mat('Mortar', '90 kg', { lifecycle: 'Product' })],
  },
  {
    name: 'Wall Construction',
    type: 'assembly',
    description:
      'Assemble a load-bearing wall from concrete, brick and mortar.',
    properties: meta({
      category: 'Construction',
      flow: 'Standard',
      emissions: '12 kgCO2e',
      loss: '3 %',
    }),
    inputs: [
      mat('Concrete', '150 kg', { category: 'Concrete' }),
      mat('Brick', '200 pcs', { category: 'Masonry' }),
      mat('Mortar', '40 kg', { category: 'Binder' }),
    ],
    outputs: [mat('Hotel Wall', '1 pcs', { lifecycle: 'Component' })],
  },
  {
    name: 'Window Assembly',
    type: 'assembly',
    properties: meta({
      category: 'Construction',
      flow: 'Standard',
      emissions: '8 kgCO2e',
    }),
    inputs: [
      mat('Glass', '6 m2', { category: 'Glazing' }),
      mat('Aluminum', '12 kg', { category: 'Metal' }),
      mat('Sealant', '2 kg'),
    ],
    outputs: [mat('Hotel Window', '1 pcs', { lifecycle: 'Component' })],
  },
  {
    name: 'Floor Assembly',
    type: 'assembly',
    properties: meta({ category: 'Construction', flow: 'Standard' }),
    inputs: [
      mat('Hotel Wall', '4 pcs', { lifecycle: 'Component' }),
      mat('Hotel Window', '2 pcs', { lifecycle: 'Component' }),
      mat('Hotel Door', '1 pcs', { lifecycle: 'Component' }),
    ],
    outputs: [mat('Hotel Floor', '1 pcs', { lifecycle: 'Component' })],
  },
  {
    name: 'Building Assembly',
    type: 'assembly',
    description: 'Final assembly of the hotel building from its components.',
    properties: meta({
      category: 'Construction',
      flow: 'Standard',
      emissions: '40 kgCO2e',
    }),
    inputs: [
      mat('Hotel Floor', '5 pcs', { lifecycle: 'Component' }),
      mat('Hotel Roof', '1 pcs', { lifecycle: 'Component' }),
      mat('Hotel Stairs', '2 pcs', { lifecycle: 'Component' }),
    ],
    outputs: [mat('Hotel Building', '1 pcs', { lifecycle: 'Product' })],
  },
  {
    name: 'Demolition',
    type: 'deconstruction',
    description: 'Selective demolition recovering reusable bulk materials.',
    properties: meta({
      category: 'Deconstruction',
      flow: 'Waste',
      emissions: '30 kgCO2e',
      loss: '20 %',
    }),
    inputs: [mat('Hotel Building', '1 pcs', { lifecycle: 'Use Phase' })],
    outputs: [
      mat('Steel', '5000 kg', { lifecycle: 'Recovered', category: 'Metal' }),
      mat('Wood', '3000 kg', { lifecycle: 'Recovered', category: 'Timber' }),
      mat('Stone', '8000 kg', { lifecycle: 'Recovered', category: 'Mineral' }),
    ],
  },
  {
    // Recycling, kept ACYCLIC: the recycled output (Asphalt) is terminal — it is not an
    // input to any process above, so it doesn't feed back and create a cycle.
    //
    // NOTE: a true recycling LOOP (e.g. Concrete -> Gravel back into Concrete Mixing) is a
    // cycle. The Sankey is acyclic and drops cycles with a notice; the Network view shows
    // loops. To demo a real loop, change the output below to "Gravel" and use the Network tab.
    name: 'Concrete Recycling',
    type: 'recycling',
    description: 'Crush concrete waste into recycled aggregate.',
    properties: meta({
      category: 'Recycling',
      flow: 'Recycled',
      emissions: '6 kgCO2e',
      loss: '10 %',
      quality: 'Downcycled',
    }),
    inputs: [mat('Concrete', '500 kg', { lifecycle: 'Waste' })],
    outputs: [
      mat('Asphalt', '450 kg', {
        lifecycle: 'Secondary Input',
        category: 'Recycled Aggregate',
      }),
    ],
  },
]
