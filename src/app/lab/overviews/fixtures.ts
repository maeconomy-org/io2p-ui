/**
 * The dashboard engine, as a data shape.
 *
 * The idea the whole thing rests on: **a widget is a QUERY plus a RENDERER**, and the two are
 * independent. The query decides what the numbers ARE; `kind` and `display` decide how they look.
 * Keeping them apart is what lets someone flip a bar chart to a table without re-picking anything.
 */

export type WidgetKind = 'kpi' | 'bar' | 'donut' | 'table' | 'trend'

// ---------------------------------------------------------------------------
// Measures
// ---------------------------------------------------------------------------

export type Operator = 'is' | 'is not' | 'over' | 'under' | 'contains'

export interface Condition {
  property: string
  op: Operator
  value: string
}

export type Aggregate =
  | { fn: 'count' }
  | { fn: 'sum' | 'avg' | 'min' | 'max'; property: string }

export interface Scoped {
  agg: Aggregate
  /** Narrows THIS aggregate, on top of the widget's own filter. */
  where: Condition[]
}

/**
 * A measure is either one aggregate or a RATIO of two.
 *
 * The ratio arm is what the domain actually asks for — "% of materials that are recycled",
 * "share of area that is office". Those are not a new aggregate function; they are the same
 * aggregate run twice with different conditions and divided. Modelling them as one `percent`
 * function would have needed a special case per question; modelling them as a ratio needs none,
 * and "total kg of concrete" falls out of the same `where` clause with no ratio at all.
 */
export type Measure =
  | { kind: 'aggregate'; agg: Aggregate; where: Condition[] }
  | { kind: 'ratio'; of: Scoped; over: Scoped }

export interface WidgetQuery {
  source: 'objects' | 'processes'
  filter: { scope: 'mine' | 'shared' | 'all'; under?: string; deleted: boolean }
  measure: Measure
  groupBy: string | null
}

/**
 * How a number is PRESENTED — deliberately separate from what it is.
 *
 * `unit` is display-only: io2p already normalises `"12.4 t"` to `num: 12400, unit: "kg"`, so the
 * widget is choosing what to show beside a number it did not compute, not doing a conversion.
 */
export interface WidgetDisplay {
  unit?: string
  decimals?: number
  /** KPI only — a second line comparing to the previous period. */
  comparison?: 'none' | 'previous'
  /** KPI only — progress toward a number someone committed to. */
  target?: number
  /** KPI only — shape of the last six periods, under the number. */
  sparkline?: boolean
  /** Above `good`, green; below `bad`, red. Only meaningful when higher/lower is better. */
  thresholds?: { good?: number; bad?: number }
}

export interface Widget {
  id: string
  title: string
  kind: WidgetKind
  query: WidgetQuery
  display: WidgetDisplay
  span: 3 | 4 | 6 | 12
}

export interface Dashboard {
  id: string
  name: string
  description: string
  widgets: Widget[]
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const NUMERIC_PROPERTIES = [
  { key: 'area', label: 'Floor area', unit: 'm²' },
  { key: 'mass', label: 'Mass', unit: 'kg' },
  { key: 'replacement_cost', label: 'Estimated value', unit: '€' },
  { key: 'occupancy', label: 'Occupancy', unit: 'people' },
  { key: 'year_built', label: 'Year built', unit: '' },
]

export const FILTER_PROPERTIES = [
  {
    key: 'material',
    label: 'Material',
    values: ['concrete', 'steel', 'timber', 'glass'],
  },
  { key: 'recycled', label: 'Recycled', values: ['true', 'false'] },
  { key: 'reusable', label: 'Reusable', values: ['true', 'false'] },
  {
    key: 'use',
    label: 'Use',
    values: ['Office', 'Storage', 'Workshop', 'Meeting room'],
  },
  { key: 'condition', label: 'Condition', values: ['Good', 'Fair', 'Poor'] },
]

export const GROUP_FIELDS = [
  { value: 'parent', label: 'Parent' },
  { value: 'owner', label: 'Owner' },
  { value: 'type', label: 'Type' },
  { value: 'use', label: 'Property: use' },
  { value: 'condition', label: 'Property: condition' },
  { value: 'material', label: 'Property: material' },
]

export const WIDGET_KINDS: {
  id: WidgetKind
  label: string
  needsGrouping: boolean
  hint: string
}[] = [
  { id: 'kpi', label: 'Number', needsGrouping: false, hint: 'One value, big' },
  { id: 'bar', label: 'Bar', needsGrouping: true, hint: 'Compare groups' },
  {
    id: 'donut',
    label: 'Donut',
    needsGrouping: true,
    hint: 'Share of a whole',
  },
  {
    id: 'trend',
    label: 'Trend',
    needsGrouping: true,
    hint: 'Change over time',
  },
  { id: 'table', label: 'Table', needsGrouping: true, hint: 'Exact figures' },
]

/** Ready-made measures for the questions this domain actually asks. */
export const MEASURE_PRESETS: {
  label: string
  measure: Measure
  display: WidgetDisplay
}[] = [
  {
    label: 'Total objects',
    measure: { kind: 'aggregate', agg: { fn: 'count' }, where: [] },
    display: {},
  },
  {
    label: 'Total floor area',
    measure: {
      kind: 'aggregate',
      agg: { fn: 'sum', property: 'area' },
      where: [],
    },
    display: { unit: 'm²' },
  },
  {
    label: 'Total kg of concrete',
    measure: {
      kind: 'aggregate',
      agg: { fn: 'sum', property: 'mass' },
      where: [{ property: 'material', op: 'is', value: 'concrete' }],
    },
    display: { unit: 'kg' },
  },
  {
    label: '% recycled material',
    measure: {
      kind: 'ratio',
      of: {
        agg: { fn: 'sum', property: 'mass' },
        where: [{ property: 'recycled', op: 'is', value: 'true' }],
      },
      over: { agg: { fn: 'sum', property: 'mass' }, where: [] },
    },
    display: { unit: '%', decimals: 1, thresholds: { good: 60, bad: 30 } },
  },
  {
    label: '% reusable material',
    measure: {
      kind: 'ratio',
      of: {
        agg: { fn: 'sum', property: 'mass' },
        where: [{ property: 'reusable', op: 'is', value: 'true' }],
      },
      over: { agg: { fn: 'sum', property: 'mass' }, where: [] },
    },
    display: { unit: '%', decimals: 1, thresholds: { good: 50, bad: 25 } },
  },
  {
    label: 'Estimated value',
    measure: {
      kind: 'aggregate',
      agg: { fn: 'sum', property: 'replacement_cost' },
      where: [],
    },
    display: { unit: '€' },
  },
]

// ---------------------------------------------------------------------------
// Sample results
// ---------------------------------------------------------------------------

export interface Slice {
  label: string
  value: number
}

export const SAMPLE_RESULTS: Record<string, Slice[]> = {
  parent: [
    { label: 'Northgate House', value: 97 },
    { label: 'Riverside Depot', value: 52 },
    { label: 'Southgate Works', value: 38 },
    { label: 'Millbrook Annex', value: 21 },
  ],
  use: [
    { label: 'Office', value: 48 },
    { label: 'Storage', value: 36 },
    { label: 'Workshop', value: 52 },
    { label: 'Meeting room', value: 31 },
  ],
  condition: [
    { label: 'Good', value: 74 },
    { label: 'Fair', value: 92 },
    { label: 'Poor', value: 42 },
  ],
  material: [
    { label: 'Concrete', value: 184_200 },
    { label: 'Steel', value: 42_800 },
    { label: 'Timber', value: 21_400 },
    { label: 'Glass', value: 8_900 },
  ],
  owner: [
    { label: 'Me', value: 128 },
    { label: 'Anna Roos', value: 54 },
    { label: 'Ben Aker', value: 26 },
  ],
  type: [
    { label: 'Building', value: 12 },
    { label: 'Floor', value: 31 },
    { label: 'Room', value: 165 },
  ],
}

export const TREND: Slice[] = [
  { label: 'Mar', value: 118 },
  { label: 'Apr', value: 126 },
  { label: 'May', value: 141 },
  { label: 'Jun', value: 152 },
  { label: 'Jul', value: 178 },
  { label: 'Aug', value: 208 },
]

export function resultFor(query: WidgetQuery): Slice[] {
  if (!query.groupBy) return []
  return SAMPLE_RESULTS[query.groupBy] ?? SAMPLE_RESULTS.parent ?? []
}

/** Deterministic stand-in — the shape of the number matters, not the arithmetic. */
export function totalFor(query: WidgetQuery): number {
  const { measure } = query
  if (measure.kind === 'ratio') {
    const conditioned = measure.of.where[0]?.value
    return conditioned === 'true' ? 63.4 : 41.2
  }
  if (measure.agg.fn === 'count') return 208
  if (measure.where.length > 0) return 184_200
  const byProperty: Record<string, number> = {
    area: 1_847,
    mass: 257_300,
    replacement_cost: 4_120_000,
    occupancy: 486,
    year_built: 1974,
  }
  return byProperty[measure.agg.property] ?? 187
}

export function conditionLabel(condition: Condition): string {
  return `${condition.property} ${condition.op} ${condition.value}`
}

export function measureLabel(measure: Measure): string {
  if (measure.kind === 'ratio') {
    const scope = measure.of.where.map(conditionLabel).join(', ')
    return `% where ${scope || 'everything'}`
  }
  const base =
    measure.agg.fn === 'count'
      ? 'Count'
      : `${measure.agg.fn.toUpperCase()} of ${measure.agg.property}`
  return measure.where.length > 0
    ? `${base} where ${measure.where.map(conditionLabel).join(', ')}`
    : base
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

const base: WidgetQuery['filter'] = { scope: 'all', deleted: false }
const preset = (index: number) => MEASURE_PRESETS[index]!

export const DASHBOARDS: Dashboard[] = [
  {
    id: 'd1',
    name: 'Portfolio overview',
    description: 'Where the estate stands this month',
    widgets: [
      {
        id: 'w1',
        title: 'Objects',
        kind: 'kpi',
        span: 3,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(0).measure,
          groupBy: null,
        },
        display: { comparison: 'previous', sparkline: true },
      },
      {
        id: 'w2',
        title: 'Total floor area',
        kind: 'kpi',
        span: 3,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(1).measure,
          groupBy: null,
        },
        display: { ...preset(1).display, comparison: 'previous' },
      },
      {
        id: 'w3',
        title: 'Recycled material',
        kind: 'kpi',
        span: 3,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(3).measure,
          groupBy: null,
        },
        display: { ...preset(3).display, target: 70 },
      },
      {
        id: 'w4',
        title: 'Estimated value',
        kind: 'kpi',
        span: 3,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(5).measure,
          groupBy: null,
        },
        display: { ...preset(5).display, comparison: 'previous' },
      },
      {
        id: 'w5',
        title: 'Mass by material',
        kind: 'bar',
        span: 6,
        query: {
          source: 'objects',
          filter: base,
          measure: {
            kind: 'aggregate',
            agg: { fn: 'sum', property: 'mass' },
            where: [],
          },
          groupBy: 'material',
        },
        display: { unit: 'kg' },
      },
      {
        id: 'w6',
        title: 'Objects over time',
        kind: 'trend',
        span: 6,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(0).measure,
          groupBy: 'month',
        },
        display: {},
      },
      {
        id: 'w7',
        title: 'Use mix',
        kind: 'donut',
        span: 6,
        query: {
          source: 'objects',
          filter: base,
          measure: {
            kind: 'aggregate',
            agg: { fn: 'sum', property: 'area' },
            where: [],
          },
          groupBy: 'use',
        },
        display: { unit: 'm²' },
      },
      {
        id: 'w8',
        title: 'Condition',
        kind: 'table',
        span: 6,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(0).measure,
          groupBy: 'condition',
        },
        display: {},
      },
    ],
  },
  {
    id: 'd2',
    name: 'Circularity',
    description: 'How much of the estate can come back',
    widgets: [
      {
        id: 'w9',
        title: 'Reusable material',
        kind: 'kpi',
        span: 4,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(4).measure,
          groupBy: null,
        },
        display: { ...preset(4).display, target: 60, sparkline: true },
      },
      {
        id: 'w10',
        title: 'Concrete on site',
        kind: 'kpi',
        span: 4,
        query: {
          source: 'objects',
          filter: base,
          measure: preset(2).measure,
          groupBy: null,
        },
        display: preset(2).display,
      },
    ],
  },
]
