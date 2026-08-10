import type { Page } from '@playwright/test'
import type { ImportItemDTO, ImportJobDTO } from 'io2p-client'

/**
 * The node's job states, served to the real UI.
 *
 * Six of the seven states cannot be produced on demand against a live node — `completed_with_errors`
 * needs a row core refuses, and a job that ended without running needs a discarded draft that was
 * once fully staged. Crafting the RESPONSE is the only way to assert each branch renders, and every
 * shape here is `ImportJobDTO`, so a contract change is a compile error rather than a stale mock.
 */

export const BASE: ImportJobDTO = {
  id: '00000000-0000-7000-8000-000000000001',
  filename: 'northgate-rooms.xlsx',
  status: 'completed',
  total: 500,
  staged: 500,
  processed: 500,
  ok: 500,
  failed: 0,
  skipped: 0,
  levels: 1,
  currentLevel: 1,
  createdAt: 1_760_000_000_000,
  startedAt: 1_760_000_000_000,
  finishedAt: 1_760_000_060_000,
}

export function job(
  overrides: Partial<ImportJobDTO> & { id: string }
): ImportJobDTO {
  return { ...BASE, ...overrides }
}

function item(seq: number, status: 'failed' | 'skipped'): ImportItemDTO {
  return {
    id: `item-${seq}`,
    seq,
    level: 0,
    // The level separator, ESCAPED and never the literal byte: a NUL lands inside git's
    // binary-detection window and the file stops being diffable.
    tempId: `Northgate House\u0000Ground\u0000Room ${seq}`,
    sourceRef: String(seq + 40),
    status,
    error: {
      code: status === 'failed' ? 'VALIDATION' : 'PARENT_FAILED',
      detail:
        status === 'failed'
          ? 'Naam ontbreekt in deze rij'
          : 'Parent row was refused',
    },
  }
}

/** Serve a fixed page of jobs, and per-job detail/items, without touching the node. */
export async function serveJobs(
  page: Page,
  jobs: ImportJobDTO[],
  options: { totalPages?: number; totalElements?: number } = {}
): Promise<void> {
  const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

  // RegExp, not a glob: Playwright's URL glob treats `?` as a single-character wildcard, so
  // `**/v1/imports?**` also matches `/v1/imports/<id>` and swallows every detail read.
  await page.route(/\/v1\/imports(\?|$)/, (route) =>
    route.fulfill(
      json({
        data: jobs,
        page: {
          number: Number(
            new URL(route.request().url()).searchParams.get('page') ?? 1
          ),
          size: 20,
          totalElements: options.totalElements ?? jobs.length,
          totalPages: options.totalPages ?? 1,
        },
      })
    )
  )

  await page.route(/\/v1\/imports\/[^/?]+$/, (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()
    const found = jobs.find((candidate) => candidate.id === id)
    return found ? route.fulfill(json(found)) : route.continue()
  })

  await page.route(/\/v1\/imports\/[^/]+\/items/, (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')
    const rows =
      status === 'failed'
        ? [item(1, 'failed'), item(2, 'failed')]
        : [item(3, 'skipped')]
    return route.fulfill(
      json({
        data: rows,
        page: {
          number: 1,
          size: 100,
          totalElements: status === 'failed' ? 120 : 1,
          totalPages: status === 'failed' ? 2 : 1,
        },
      })
    )
  })
}
