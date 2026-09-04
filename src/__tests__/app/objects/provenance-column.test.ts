// Objects and processes both list with `scope: 'all'`, so a table shows rows the viewer did not
// create. Without an attribution column those are indistinguishable from their own.

import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '' }),
}))

import { buildObjectColumns } from '@/app/objects/components/object-columns'
import { buildProcessColumns } from '@/app/processes/components/process-columns'

const t = (key: string) => key

const idsOf = (columns: { id?: string }[]) => columns.map((c) => c.id)

describe('provenance columns', () => {
  it('the objects table attributes each row', () => {
    const columns = buildObjectColumns({ t, actions: {} } as never)
    expect(idsOf(columns)).toContain('createdBy')
  })

  it('the processes table attributes each row', () => {
    const columns = buildProcessColumns({
      t,
      actions: {},
      currentUserId: 'me-1',
    } as never)
    expect(idsOf(columns)).toContain('createdBy')
  })
})
