import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ShareSheet } from '@/components/access'

const list = vi.fn()
const grant = vi.fn()
const revoke = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    access: { grants: { list, grant, revoke } },
    users: { list: vi.fn().mockResolvedValue({ data: [], page: {} }) },
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({ dateTime: () => '24 Jun 2026' }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))
vi.mock('@/hooks/api/users', () => ({
  useUserDirectory: () => ({ nameOf: (id: string) => `name:${id}` }),
  useUserSearch: () => ({ users: [], isFetching: false }),
}))

function grantRow(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    resource: { type: 'object', id: 'obj-1' },
    subject: { kind: 'user', userId: 'u1' },
    permission: 'read',
    includeDescendants: false,
    active: true,
    grantedBy: 'me',
    currentVersion: 1,
    createdAt: 1719230000000,
    updatedAt: 1719230000000,
    ...over,
  }
}

function renderSheet(rows: unknown[]) {
  list.mockResolvedValue({
    data: rows,
    page: { number: 1, size: 20, totalElements: rows.length, totalPages: 1 },
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ShareSheet, {
        open: true,
        onOpenChange: vi.fn(),
        target: { type: 'object' as const, id: 'obj-1', name: 'Wall A' },
        isOwner: true,
      })
    )
  )
}

describe('ShareSheet revoked history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant.mockResolvedValue({})
    revoke.mockResolvedValue({})
  })

  it('asks for revoked rows in the SAME read, not a second one', async () => {
    renderSheet([grantRow()])

    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(list.mock.calls[0][1]).toMatchObject({ revoked: 'include' })
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('keeps a revoked grant OUT of the editable members', async () => {
    // The hazard: seeded into the draft, a removed person is listed as a member and the next Save
    // re-grants them — silently undoing the revoke.
    renderSheet([
      grantRow({ id: 'g1', subject: { kind: 'user', userId: 'u1' } }),
      grantRow({
        id: 'g2',
        subject: { kind: 'user', userId: 'u2' },
        active: false,
      }),
    ])

    await screen.findByText('access.revokedTitle')
    // u1 is a member row (has a permission select); u2 must not be.
    expect(
      screen.queryByLabelText('access.permissionFor:{"name":"name:u2"}')
    ).toBeNull()
    expect(
      screen.getByLabelText('access.permissionFor:{"name":"name:u1"}')
    ).toBeTruthy()
  })

  it('hides the section entirely when nothing was ever revoked', async () => {
    renderSheet([grantRow()])

    await screen.findByText('access.peopleWithAccess')
    expect(screen.queryByText('access.revokedTitle')).toBeNull()
  })

  it('states the ceiling — last permission held, not an audit trail', async () => {
    // Two DIFFERENT subjects: u1's own revoked row would be suppressed while u1 is still active.
    renderSheet([
      grantRow(),
      grantRow({
        id: 'g2',
        subject: { kind: 'user', userId: 'u2' },
        active: false,
      }),
    ])

    fireEvent.click(await screen.findByText('access.revokedTitle'))
    expect(screen.getByText('access.revokedHint')).toBeTruthy()
  })

  it('restores by re-granting the permission the subject held', async () => {
    renderSheet([
      grantRow(),
      grantRow({
        id: 'g2',
        subject: { kind: 'user', userId: 'u2' },
        permission: 'write',
        active: false,
      }),
    ])

    fireEvent.click(await screen.findByText('access.revokedTitle'))
    fireEvent.click(screen.getByText('common.restore'))

    // `grant` upserts on (resource, subject), so no new endpoint is needed — and the rung must be
    // the one they had, not a default.
    await waitFor(() => expect(grant).toHaveBeenCalledTimes(1))
    expect(grant.mock.calls[0][0]).toMatchObject({
      subject: { kind: 'user', userId: 'u2' },
      permission: 'write',
    })
  })

  it('shows a Share-owned grant WITHOUT controls that cannot write', async () => {
    // io2p keys a grant by (resource, subject, SOURCE). `revoke` from here carries no shareId, so
    // it targets the direct row and returns `revoked: false` when there isn't one — an X and a
    // permission select would be two normal-looking controls that do nothing.
    renderSheet([
      grantRow({ shareId: 'share-9', subject: { kind: 'user', userId: 'u2' } }),
    ])

    expect(await screen.findByText('access.fromShareBundle')).toBeTruthy()
    expect(
      screen.queryByLabelText('access.permissionFor:{"name":"name:u2"}')
    ).toBeNull()
    expect(
      screen.queryByLabelText('access.revokeFor:{"name":"name:u2"}')
    ).toBeNull()
  })

  it('keeps a DIRECT grant fully editable alongside a Share-owned one', async () => {
    // The union is real: the same person can hold both. The direct half is this sheet's to write.
    renderSheet([
      grantRow({ id: 'd1', subject: { kind: 'user', userId: 'u1' } }),
      grantRow({
        id: 's1',
        shareId: 'share-9',
        subject: { kind: 'user', userId: 'u2' },
      }),
    ])

    expect(
      await screen.findByLabelText('access.permissionFor:{"name":"name:u1"}')
    ).toBeTruthy()
    expect(screen.getByText('access.fromShareBundle')).toBeTruthy()
  })

  it('says nothing about bundles for a direct grant', async () => {
    renderSheet([grantRow()])

    await screen.findByText('access.peopleWithAccess')
    expect(screen.queryByText('access.fromShareBundle')).toBeNull()
  })
})

describe('ShareSheet revoked history — append-only grants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant.mockResolvedValue({})
    revoke.mockResolvedValue({})
  })

  it('does not list someone as former when they hold access NOW', async () => {
    // THE REGRESSION. Grants are append-only, so a subject's old revoked row survives alongside the
    // active one that replaced it — listing every `!active` row put people in BOTH sections at once.
    renderSheet([
      grantRow({ id: 'old', active: false, updatedAt: 1719230000000 }),
      grantRow({ id: 'now', active: true, updatedAt: 1719240000000 }),
    ])

    await screen.findByText('access.peopleWithAccess')
    expect(screen.queryByText('access.revokedTitle')).toBeNull()
  })

  it('collapses repeated revokes to the most recent one', async () => {
    renderSheet([
      grantRow({ id: 'r1', active: false, updatedAt: 1719230000000 }),
      grantRow({ id: 'r2', active: false, updatedAt: 1719240000000 }),
    ])

    fireEvent.click(await screen.findByText('access.revokedTitle'))
    // One person, one row — not one row per revoke event.
    expect(screen.getAllByText('common.restore')).toHaveLength(1)
  })

  it('still lists a subject whose only rows are revoked', async () => {
    renderSheet([
      grantRow({ id: 'g1', subject: { kind: 'user', userId: 'u1' } }),
      grantRow({
        id: 'g2',
        subject: { kind: 'user', userId: 'u2' },
        active: false,
      }),
    ])

    fireEvent.click(await screen.findByText('access.revokedTitle'))
    expect(screen.getAllByText('common.restore')).toHaveLength(1)
  })
})

describe('ShareSheet — a grant is keyed by subject AND source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant.mockResolvedValue({})
    revoke.mockResolvedValue({})
  })

  it('lists a revoked DIRECT grant even while a Share still grants that person', async () => {
    // The screenshot case. Two real rows, two sources: the ad-hoc grant was revoked, the Share's
    // is live. Collapsing by subject hid a genuine revocation; ignoring source listed them as
    // former while they plainly still had access.
    renderSheet([
      grantRow({ id: 'direct', active: false }),
      grantRow({ id: 'viaShare', active: true, shareId: 'share-9' }),
    ])

    fireEvent.click(await screen.findByText('access.revokedTitle'))
    expect(screen.getAllByText('common.restore')).toHaveLength(1)
    // …and they are still shown as having access, from the share.
    expect(screen.getByText('access.fromShareBundle')).toBeTruthy()
  })

  it('does not list a source that is still live', async () => {
    renderSheet([
      grantRow({ id: 'old', active: false, shareId: 'share-9' }),
      grantRow({ id: 'now', active: true, shareId: 'share-9' }),
    ])

    await screen.findByText('access.peopleWithAccess')
    expect(screen.queryByText('access.revokedTitle')).toBeNull()
  })
})
