/**
 * Types + dummy data for the import STATUS views.
 *
 * The types are now aliases of the SDK's, not hand-written copies: the lab reads the real API,
 * so a local shape that merely resembled `ImportJobDTO` would drift the moment the contract
 * moved, and drift silently. The fixtures below are kept only as a fallback for judging layout
 * against a full table when no import has been run yet.
 */

import type { ImportItemDTO, ImportJobDTO } from 'io2p-client'

/** The seven states a job can be in — from the SDK, so it cannot fall behind the node. */
export type LabJobStatus = ImportJobDTO['status']
export type LabJob = ImportJobDTO
export type LabItem = ImportItemDTO

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
  },
]

/** The per-row report — the thing today's page cannot show at all. */
export const LAB_ITEMS: Record<string, LabItem[]> = {
  'b1c47f02-88ae-4d63-bb10-6c2e9a4f7d51': [
    {
      id: 'item-47',
      seq: 47,
      level: 0,
      tempId: 'Riverside Depot/Ground/107',
      status: 'failed',
      error: {
        code: 'value_xor',
        detail: 'Property "area" on row 47: a value has none of [data, calc].',
      },
    },
    {
      id: 'item-112',
      seq: 112,
      level: 0,
      tempId: 'Southgate Works',
      status: 'failed',
      error: {
        code: 'name_required',
        detail: 'name is required and was empty.',
      },
    },
    {
      id: 'item-118',
      seq: 118,
      level: 0,
      tempId: 'Southgate Works/Ground',
      status: 'skipped',
      error: {
        code: 'parent_failed',
        detail: 'depends on failed Southgate Works',
      },
    },
    {
      id: 'item-119',
      seq: 119,
      level: 0,
      tempId: 'Southgate Works/Ground/101',
      status: 'skipped',
      error: {
        code: 'parent_failed',
        detail: 'depends on failed Southgate Works',
      },
    },
    {
      id: 'item-120',
      seq: 120,
      level: 0,
      tempId: 'Southgate Works/Ground/102',
      status: 'skipped',
      error: {
        code: 'parent_failed',
        detail: 'depends on failed Southgate Works',
      },
    },
    {
      id: 'item-301',
      seq: 301,
      level: 0,
      tempId: 'Millbrook Annex/First',
      status: 'failed',
      error: {
        code: 'unknown_parent',
        detail: 'unknown parent id 0190b3f2-…-4d5e',
      },
    },
    {
      id: 'item-640',
      seq: 640,
      level: 0,
      tempId: 'Harbour Point',
      status: 'failed',
      error: {
        code: 'value_xor',
        detail:
          'Property "condition" on row 640: a value has none of [data, calc].',
      },
    },
  ],
  'a3f91c7e-4b2d-4e11-9c8a-1f0e5d7b2a34': [
    {
      id: 'item-88',
      seq: 88,
      level: 0,
      tempId: 'Northgate House/First/204',
      status: 'failed',
      error: {
        code: 'value_xor',
        detail:
          'Property "height" on row 88: a value has none of [data, calc].',
      },
    },
    {
      id: 'item-204',
      seq: 204,
      level: 0,
      tempId: 'Eastfield Store',
      status: 'failed',
      error: {
        code: 'name_required',
        detail: 'name is required and was empty.',
      },
    },
    {
      id: 'item-205',
      seq: 205,
      level: 0,
      tempId: 'Eastfield Store/Ground',
      status: 'skipped',
      error: {
        code: 'parent_failed',
        detail: 'depends on failed Eastfield Store',
      },
    },
  ],
}
