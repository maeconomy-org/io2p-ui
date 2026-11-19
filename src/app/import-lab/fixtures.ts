/**
 * Dummy data for the import lab. Shaped to core's `ImportJobDTO` (bulk-import-plan §3d) plus one
 * field we do not have yet and should ask for: `filename`.
 *
 * Timestamps are fixed literals rather than offsets from now, so the layout renders identically on
 * every reload and two people looking at it see the same numbers.
 */

export type LabJobStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled'

export interface LabJob {
  id: string
  /** NOT in core's DTO yet — the ask. `a3f9…` is a poor row label after six imports. */
  filename: string
  status: LabJobStatus
  /** Items core accepted. While `draft`, this is what resume counts against. */
  staged: number
  total: number
  /** attempted = ok + failed + skipped. Honest about POSITION, not about outcome. */
  processed: number
  ok: number
  failed: number
  skipped: number
  levels: number
  currentLevel: number
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  /** Job-level failure only. Per-row errors live on the items. */
  error: string | null
}

export interface LabItem {
  seq: number
  tempId: string
  status: 'failed' | 'skipped'
  code: string
  detail: string
}

export const LAB_JOBS: LabJob[] = [
  {
    id: 'a3f91c7e-4b2d-4e11-9c8a-1f0e5d7b2a34',
    filename: 'northgate-rooms.xlsx',
    status: 'running',
    staged: 10_000,
    total: 10_000,
    processed: 4210,
    ok: 4180,
    failed: 28,
    skipped: 2,
    levels: 3,
    currentLevel: 2,
    createdAt: 1754300000000,
    startedAt: 1754300180000,
    finishedAt: null,
    error: null,
  },
  {
    id: 'b1c47f02-88ae-4d63-bb10-6c2e9a4f7d51',
    filename: 'riverside-depot-q3.csv',
    status: 'completed_with_errors',
    staged: 1200,
    total: 1200,
    processed: 1200,
    ok: 1176,
    failed: 10,
    skipped: 14,
    levels: 2,
    currentLevel: 2,
    createdAt: 1754290000000,
    startedAt: 1754290090000,
    finishedAt: 1754290194000,
    error: null,
  },
  {
    id: 'c7e2aa40-1d5b-4f88-90c3-2b7a6e13f9d0',
    filename: 'asset-register-2026.xlsx',
    status: 'completed',
    staged: 8400,
    total: 8400,
    processed: 8400,
    ok: 8400,
    failed: 0,
    skipped: 0,
    levels: 1,
    currentLevel: 1,
    createdAt: 1754280000000,
    startedAt: 1754280060000,
    finishedAt: 1754280422000,
    error: null,
  },
  {
    id: 'd0f18b93-6c4a-4a27-81ff-5e9d3c08b7a2',
    filename: 'annex-buildings.csv',
    status: 'draft',
    staged: 3400,
    total: 9000,
    processed: 0,
    ok: 0,
    failed: 0,
    skipped: 0,
    levels: 1,
    currentLevel: 0,
    createdAt: 1754301400000,
    startedAt: null,
    finishedAt: null,
    error: null,
  },
  {
    id: 'e5a73d16-2f90-4cb5-a4d8-0b61e7f2c983',
    filename: 'land-parcels.xlsx',
    status: 'failed',
    staged: 640,
    total: 640,
    processed: 0,
    ok: 0,
    failed: 0,
    skipped: 0,
    levels: 4,
    currentLevel: 0,
    createdAt: 1754270000000,
    startedAt: 1754270040000,
    finishedAt: 1754270041000,
    error:
      'Cycle in parent references: Parcel 204 → Parcel 204-01 → Parcel 204-11 → Parcel 204. Nothing was written.',
  },
  {
    id: 'f2b04e58-7a13-4d92-8c6e-3f5a1b9d0c47',
    filename: 'floors.csv',
    status: 'cancelled',
    staged: 2200,
    total: 2200,
    processed: 900,
    ok: 894,
    failed: 6,
    skipped: 0,
    levels: 2,
    currentLevel: 1,
    createdAt: 1754260000000,
    startedAt: 1754260070000,
    finishedAt: 1754260340000,
    error: null,
  },
]

/** The per-row report — the thing today's page cannot show at all. */
export const LAB_ITEMS: Record<string, LabItem[]> = {
  'b1c47f02-88ae-4d63-bb10-6c2e9a4f7d51': [
    {
      seq: 47,
      tempId: 'Riverside Depot/Ground/107',
      status: 'failed',
      code: 'VALUE_XOR',
      detail: 'Property "area" on row 47: a value has none of [data, calc].',
    },
    {
      seq: 112,
      tempId: 'Southgate Works',
      status: 'failed',
      code: 'NAME_REQUIRED',
      detail: 'name is required and was empty.',
    },
    {
      seq: 118,
      tempId: 'Southgate Works/Ground',
      status: 'skipped',
      code: 'PARENT_FAILED',
      detail: 'depends on failed Southgate Works',
    },
    {
      seq: 119,
      tempId: 'Southgate Works/Ground/101',
      status: 'skipped',
      code: 'PARENT_FAILED',
      detail: 'depends on failed Southgate Works',
    },
    {
      seq: 120,
      tempId: 'Southgate Works/Ground/102',
      status: 'skipped',
      code: 'PARENT_FAILED',
      detail: 'depends on failed Southgate Works',
    },
    {
      seq: 301,
      tempId: 'Millbrook Annex/First',
      status: 'failed',
      code: 'UNKNOWN_PARENT',
      detail: 'unknown parent id 0190b3f2-…-4d5e',
    },
    {
      seq: 640,
      tempId: 'Harbour Point',
      status: 'failed',
      code: 'ADDRESS_INVALID',
      detail:
        'address.country must be a 2-letter ISO code, got "United States".',
    },
  ],
  'a3f91c7e-4b2d-4e11-9c8a-1f0e5d7b2a34': [
    {
      seq: 88,
      tempId: 'Northgate House/First/204',
      status: 'failed',
      code: 'VALUE_XOR',
      detail: 'Property "height" on row 88: a value has none of [data, calc].',
    },
    {
      seq: 204,
      tempId: 'Eastfield Store',
      status: 'failed',
      code: 'NAME_REQUIRED',
      detail: 'name is required and was empty.',
    },
    {
      seq: 205,
      tempId: 'Eastfield Store/Ground',
      status: 'skipped',
      code: 'PARENT_FAILED',
      detail: 'depends on failed Eastfield Store',
    },
  ],
}
