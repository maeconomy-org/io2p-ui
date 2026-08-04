/**
 * Agent fixtures, shaped like the API this would eventually talk to rather than like the screen.
 *
 * A `Conversation` is the unit that gets listed, renamed, deleted and shared; a `Message` is the
 * unit that streams. Keeping them separate is the future-proofing — a chat UI built around one
 * flat array of bubbles has to be rewritten the moment history, titles or resume arrive.
 */

import type { Widget } from '../overviews/fixtures'

export type Role = 'user' | 'agent'

/**
 * A message is a LIST OF PARTS, not a string.
 *
 * This is the decision everything else hangs off. A model that can only hold markdown cannot
 * carry an image, cite the objects it counted, or hand back something openable — and retrofitting
 * parts later means rewriting every renderer at once. The cost now is one union.
 */
export type Part =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string; alt: string; caption?: string }
  | { kind: 'file'; name: string; size: string; mime: string }
  /** Objects the answer was derived from — the citation, so a number can be checked. */
  | { kind: 'objects'; items: { id: string; name: string; detail: string }[] }
  /** Something big enough to deserve its own surface. Rendered as a card, opened in the panel. */
  | { kind: 'artifact'; artifactId: string }

export interface Message {
  id: string
  role: Role
  parts: Part[]
  createdAt: number
}

export interface Conversation {
  id: string
  /** Generated from the first message server-side, renameable. Never the raw prompt. */
  title: string
  updatedAt: number
  messages: Message[]
}

/**
 * An artifact is a RESULT with a life of its own — nameable, re-openable, and in the widget case
 * saveable somewhere else entirely. Keeping them out of the message body is what lets the side
 * panel exist: the thread shows a reference, the panel shows the thing.
 */
export interface DraftNode {
  name: string
  level: number
  properties: string
}

export type Artifact =
  | { id: string; kind: 'widget'; title: string; widget: Widget }
  | {
      id: string
      kind: 'table'
      title: string
      columns: string[]
      rows: string[][]
    }
  | { id: string; kind: 'note'; title: string; markdown: string }
  /**
   * A proposed tree of objects, NOT YET SAVED.
   *
   * The single most important artifact in an append-only store: an agent that writes directly
   * cannot be undone, only soft-deleted after the fact. Making the proposal a reviewable object
   * with its own Save button turns an irreversible action into a decision.
   */
  | { id: string; kind: 'draft'; title: string; nodes: DraftNode[] }
  /** A formula with its bindings and a worked example — the audit trail for a computed value. */
  | {
      id: string
      kind: 'formula'
      title: string
      expression: string
      bindings: { variable: string; source: string; value: string }[]
      result: string
    }
  /** A filter the agent assembled, savable as a view rather than re-asked every morning. */
  | {
      id: string
      kind: 'view'
      title: string
      conditions: string[]
      matches: number
    }

export interface Skill {
  id: string
  label: string
  description: string
  /** Writes to your OBJECTS — the irreversible kind, in an append-only store. */
  writes: boolean
  /** Creates something in your workspace that is not an object (a dashboard, a saved view). */
  builds?: boolean
}

export const SKILLS: Skill[] = [
  {
    id: 'search',
    label: 'Search objects',
    description: 'Find objects, processes and templates by name or property',
    writes: false,
  },
  {
    id: 'summarise',
    label: 'Summarise a subtree',
    description: 'Roll up properties and values under any object',
    writes: false,
  },
  {
    id: 'formulas',
    label: 'Explain a formula',
    description: 'Trace a computed value back to its inputs and constants',
    writes: false,
  },
  {
    id: 'dashboard',
    label: 'Build a dashboard',
    description: 'Turn a question into a widget you can keep',
    writes: false,
    builds: true,
  },
  {
    id: 'draft',
    label: 'Draft objects',
    description: 'Propose a tree of objects for you to review before saving',
    writes: true,
  },
]

export const EXAMPLES = [
  {
    icon: 'boxes',
    title: 'Summarise a building',
    body: 'Total floor area and use mix across every room',
  },
  {
    icon: 'chart',
    title: 'Chart area by building',
    body: 'Build a widget I can put on a dashboard',
  },
  {
    icon: 'sigma',
    title: 'Explain a value',
    body: 'Trace a computed property back to its formula',
  },
] as const

const HOUR = 3_600_000
const NOW = 1754301600000

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export const ARTIFACTS: Record<string, Artifact> = {
  a1: {
    id: 'a1',
    kind: 'widget',
    title: 'Area by building',
    widget: {
      id: 'agent-w1',
      title: 'Area by building',
      kind: 'bar',
      span: 12,
      display: { unit: 'm²' },
      query: {
        source: 'objects',
        filter: { scope: 'all', deleted: false },
        measure: {
          kind: 'aggregate',
          agg: { fn: 'sum', property: 'area' },
          where: [],
        },
        groupBy: 'parent',
      },
    },
  },
  a3: {
    id: 'a3',
    kind: 'draft',
    title: '3 floors and 12 rooms under Southgate Works',
    nodes: [
      { name: 'Southgate Works', level: 0, properties: 'address, year_built' },
      { name: 'Ground', level: 1, properties: '—' },
      { name: 'Room 101', level: 2, properties: 'area 24 m², use Office' },
      { name: 'Room 102', level: 2, properties: 'area 18 m², use Storage' },
      { name: 'First', level: 1, properties: '—' },
      { name: 'Room 201', level: 2, properties: 'area 31 m², use Meeting' },
    ],
  },
  a4: {
    id: 'a4',
    kind: 'formula',
    title: 'Embodied CO₂',
    expression: 'mass * co2_factor',
    bindings: [
      { variable: 'mass', source: 'this object · property', value: '3,260 kg' },
      {
        variable: 'co2_factor',
        source: 'constant · pinned to v1',
        value: '0.42',
      },
    ],
    result: '1,369.2 kg',
  },
  a5: {
    id: 'a5',
    kind: 'view',
    title: 'Rooms needing inspection',
    conditions: [
      'type is Room',
      'condition is Poor',
      'last_inspected is older than 2 years',
    ],
    matches: 47,
  },
  a2: {
    id: 'a2',
    kind: 'table',
    title: 'Rooms with no use recorded',
    columns: ['Room', 'Building', 'Area'],
    rows: [
      ['104', 'Northgate House', '12 m²'],
      ['205', 'Northgate House', '9 m²'],
      ['B2', 'Riverside Depot', '31 m²'],
    ],
  },
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    title: 'Floor area across Northgate House',
    updatedAt: NOW - HOUR,
    messages: [
      {
        id: 'm1',
        role: 'user',
        parts: [
          {
            kind: 'text',
            text: 'What is the total floor area of Northgate House?',
          },
        ],
        createdAt: NOW - HOUR - 60_000,
      },
      {
        id: 'm2',
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: `**Northgate House** is **97 m²** across 4 rooms on 2 floors.

- **Ground** — 42 m² (101: 24 m², 102: 18 m²)
- **First** — 55 m² (201: 24 m², 202: 31 m²)`,
          },
          {
            kind: 'objects',
            items: [
              { id: 'o1', name: 'Room 101', detail: 'Ground · 24 m² · Office' },
              {
                id: 'o2',
                name: 'Room 102',
                detail: 'Ground · 18 m² · Storage',
              },
              { id: 'o3', name: 'Room 201', detail: 'First · 24 m² · Office' },
              { id: 'o4', name: 'Room 202', detail: 'First · 31 m² · Meeting' },
            ],
          },
          {
            kind: 'text',
            text: 'Two rooms have no `area` value and are excluded.',
          },
        ],
        createdAt: NOW - HOUR,
      },
    ],
  },
  {
    id: 'c2',
    title: 'Area by building, as a chart',
    updatedAt: NOW - 3 * HOUR,
    messages: [
      {
        id: 'm3',
        role: 'user',
        parts: [
          {
            kind: 'text',
            text: 'Chart the total floor area for each building',
          },
        ],
        createdAt: NOW - 3 * HOUR - 30_000,
      },
      {
        id: 'm4',
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: 'Here is **sum of `area`, grouped by parent**. Open it to change the measure or add it to a dashboard.',
          },
          { kind: 'artifact', artifactId: 'a1' },
        ],
        createdAt: NOW - 3 * HOUR,
      },
    ],
  },
  {
    id: 'c3',
    title: 'Floor plan for Riverside Depot',
    updatedAt: NOW - 26 * HOUR,
    messages: [
      {
        id: 'm5',
        role: 'user',
        parts: [
          {
            kind: 'text',
            text: 'Show me the floor plan attached to the depot',
          },
          { kind: 'file', name: 'rd-ground.pdf', size: '1.2 MB', mime: 'pdf' },
        ],
        createdAt: NOW - 26 * HOUR - 20_000,
      },
      {
        id: 'm6',
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: 'This is the ground floor plan referenced on **Riverside Depot**.',
          },
          {
            kind: 'image',
            url: '',
            alt: 'Ground floor plan for Riverside Depot',
            caption: 'rd-ground.pdf · page 1',
          },
        ],
        createdAt: NOW - 26 * HOUR,
      },
    ],
  },
  {
    id: 'c4',
    title: 'Rooms with no use recorded',
    updatedAt: NOW - 74 * HOUR,
    messages: [],
  },
]

/** Today / Yesterday / Earlier — the grouping every chat list converges on. */
export function groupByDay(conversations: Conversation[]) {
  const day = 24 * HOUR
  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ]
  conversations.forEach((c) => {
    const age = NOW - c.updatedAt
    const bucket = age < day ? 0 : age < 2 * day ? 1 : 2
    groups[bucket]?.items.push(c)
  })
  return groups.filter((g) => g.items.length > 0)
}
