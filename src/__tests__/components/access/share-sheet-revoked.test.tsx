import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ShareSheet } from '@/components/access'

const list = vi.fn()
const grant = vi.fn()
const revoke = vi.fn()

const shareList = vi.fn()
const shareUpdate = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    access: {
      grants: { list, grant, revoke },
      shares: { list: shareList, update: shareUpdate },
    },
    users: { list: vi.fn().mockResolvedValue({ data: [], page: {} }) },
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({ dateTime: () => '24 Jun 2026' }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))
// No `useUserDirectory` — the sheet must not reach for one. Every name it renders now arrives
// resolved on the grant, so mocking a directory here would hide a regression back to the old
// page-of-users lookup rather than catch it.
vi.mock('@/hooks/api/users', () => ({
  useUserSearch: () => ({ users: [], isFetching: false }),
}))

function grantRow(over: Record<string, unknown> = {}) {
  const row = {
    id: 'g1',
    resource: { type: 'object', id: 'obj-1' },
    subject: { kind: 'user', userId: 'u1' } as {
      kind: string
      userId?: string
      name?: string
    },
    permission: 'read',
    includeDescendants: false,
    active: true,
    grantedBy: 'me',
    currentVersion: 1,
    createdAt: 1719230000000,
    updatedAt: 1719230000000,
    ...over,
  }
  // The node resolves the grantee's name ONTO the row, so the fixture does too. A subject that
  // wants to test the unresolved case passes `name: undefined` explicitly.
  if (row.subject.kind === 'user' && !('name' in row.subject)) {
    row.subject = { ...row.subject, name: `name:${row.subject.userId}` }
  }
  return row
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
    shareUpdate.mockResolvedValue({})
    shareList.mockResolvedValue({
      data: [
        {
          id: 'share-9',
          name: 'Q3 rollout',
          resources: [
            { type: 'object', id: 'o1', name: 'Wall A' },
            { type: 'object', id: 'o2', name: 'Wall B' },
          ],
        },
      ],
      page: { number: 1, size: 100, totalElements: 1, totalPages: 1 },
    })
  })

  it('asks for revoked rows in the SAME read, not a second one', async () => {
    renderSheet([grantRow()])

    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(list.mock.calls[0][1]).toMatchObject({ revoked: 'include' })
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('renders the name the node resolved onto the grant', async () => {
    renderSheet([
      grantRow({ subject: { kind: 'user', userId: 'u1', name: 'Anna Roos' } }),
    ])

    expect(
      await screen.findByLabelText('access.permissionFor:{"name":"Anna Roos"}')
    ).toBeTruthy()
  })

  /**
   * `name` is OMITTED, never blank, when a user has no display name or the id no longer resolves.
   * Falling back to the id keeps an unresolved grantee visible; an empty label would render a row
   * that reads as nobody at all — a failure indistinguishable from success.
   */
  it('falls back to the id when the node could not resolve a name', async () => {
    renderSheet([
      grantRow({ subject: { kind: 'user', userId: 'u1', name: undefined } }),
    ])

    expect(
      await screen.findByLabelText('access.permissionFor:{"name":"u1"}')
    ).toBeTruthy()
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

    // §4: a "via <bundle>" chip and a deep-link, and NO controls — editing belongs to the share.
    expect(
      await screen.findByText('access.viaShare:{"name":"Q3 rollout"}')
    ).toBeTruthy()
    expect(screen.getByText('access.manageBundle')).toBeTruthy()
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
    expect(screen.getByText('access.manageBundle')).toBeTruthy()
  })

  it('says nothing about bundles for a direct grant', async () => {
    renderSheet([grantRow()])

    await screen.findByText('access.peopleWithAccess')
    expect(screen.queryByText('access.manageBundle')).toBeNull()
  })
})

describe('ShareSheet revoked history — append-only grants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant.mockResolvedValue({})
    revoke.mockResolvedValue({})
    shareUpdate.mockResolvedValue({})
    shareList.mockResolvedValue({
      data: [
        {
          id: 'share-9',
          name: 'Q3 rollout',
          resources: [
            { type: 'object', id: 'o1', name: 'Wall A' },
            { type: 'object', id: 'o2', name: 'Wall B' },
          ],
        },
      ],
      page: { number: 1, size: 100, totalElements: 1, totalPages: 1 },
    })
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
    shareUpdate.mockResolvedValue({})
    shareList.mockResolvedValue({
      data: [
        {
          id: 'share-9',
          name: 'Q3 rollout',
          resources: [
            { type: 'object', id: 'o1', name: 'Wall A' },
            { type: 'object', id: 'o2', name: 'Wall B' },
          ],
        },
      ],
      page: { number: 1, size: 100, totalElements: 1, totalPages: 1 },
    })
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
    expect(screen.getByText('access.manageBundle')).toBeTruthy()
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

describe('ShareSheet — removing a member from the bundle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant.mockResolvedValue({})
    revoke.mockResolvedValue({})
    shareUpdate.mockResolvedValue({})
    shareList.mockResolvedValue({
      data: [
        {
          id: 'share-9',
          name: 'Q3 rollout',
          resources: [
            { type: 'object', id: 'o1', name: 'Wall A' },
            { type: 'object', id: 'o2', name: 'Wall B' },
          ],
        },
      ],
      page: { number: 1, size: 100, totalElements: 1, totalPages: 1 },
    })
  })

  it('names the blast radius BEFORE firing, because a share is a cross product', async () => {
    renderSheet([
      grantRow({ shareId: 'share-9', subject: { kind: 'user', userId: 'u2' } }),
    ])

    fireEvent.click(await screen.findByText('access.removeFromShare'))

    // The confirm resolves the actual items — a count in a button label would not say WHICH.
    expect(
      screen.getByText(/access.removeFromShareBody.*Wall A, Wall B/)
    ).toBeTruthy()
    expect(shareUpdate).not.toHaveBeenCalled()
  })

  it('edits the BUNDLE, not the grant — that is why it is allowed', async () => {
    renderSheet([
      grantRow({ shareId: 'share-9', subject: { kind: 'user', userId: 'u2' } }),
    ])

    fireEvent.click(await screen.findByText('access.removeFromShare'))
    fireEvent.click(screen.getByText('common.delete'))

    // `members: { remove }` on the SHARE; the service re-syncs the grants, so the bundle and its
    // expansion cannot drift. A direct revoke here would have been the forbidden inline edit.
    await waitFor(() => expect(shareUpdate).toHaveBeenCalledTimes(1))
    expect(shareUpdate.mock.calls[0]).toEqual([
      'share-9',
      { members: { remove: ['u2'] } },
    ])
    expect(revoke).not.toHaveBeenCalled()
  })

  it('offers nothing to remove for public, which is not a share member', async () => {
    renderSheet([grantRow({ shareId: 'share-9', subject: { kind: 'public' } })])

    await screen.findByText('access.manageBundle')
    expect(screen.queryByText('access.removeFromShare')).toBeNull()
  })
})

describe('ShareSheet directOnly — the Direct shares tab stays direct', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant.mockResolvedValue({})
    revoke.mockResolvedValue({})
    shareUpdate.mockResolvedValue({})
    shareList.mockResolvedValue({
      data: [{ id: 'share-9', name: 'Q3 rollout', resources: [] }],
      page: { number: 1, size: 100, totalElements: 1, totalPages: 1 },
    })
  })

  /**
   * The mock APPLIES `source`, because the node does.
   *
   * Filtering moved out of the sheet the day `?source=` shipped, so a mock that returned every row
   * regardless would prove only that the component ignores the parameter it now depends on.
   */
  function renderDirect(rows: unknown[]) {
    list.mockImplementation(
      (_resource: unknown, query?: { source?: string }) => {
        const data =
          query?.source === 'direct'
            ? rows.filter((r) => !(r as { shareId?: string }).shareId)
            : rows
        return Promise.resolve({
          data,
          page: {
            number: 1,
            size: 20,
            totalElements: data.length,
            totalPages: 1,
          },
        })
      }
    )
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
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
          directOnly: true,
        })
      )
    )
  }

  it('asks the node for direct grants only — the filter is a request parameter, not a client pass', async () => {
    renderDirect([grantRow({ subject: { kind: 'user', userId: 'u1' } })])

    await screen.findByLabelText('access.permissionFor:{"name":"name:u1"}')
    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'direct', revoked: 'include' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('shows no bundle rows at all — no chip, no Manage bundle, no Remove from share', async () => {
    renderDirect([
      grantRow({ id: 'd1', subject: { kind: 'user', userId: 'u1' } }),
      grantRow({
        id: 's1',
        shareId: 'share-9',
        subject: { kind: 'user', userId: 'u2' },
      }),
    ])

    await screen.findByLabelText('access.permissionFor:{"name":"name:u1"}')
    expect(screen.queryByText('access.manageBundle')).toBeNull()
    expect(screen.queryByText('access.removeFromShare')).toBeNull()
    expect(screen.queryByText('access.viaShareUnnamed')).toBeNull()
  })

  it('keeps the ad-hoc members fully editable', async () => {
    renderDirect([grantRow({ subject: { kind: 'user', userId: 'u1' } })])

    expect(
      await screen.findByLabelText('access.permissionFor:{"name":"name:u1"}')
    ).toBeTruthy()
  })

  it('narrows revoked history too — a bundle revocation is not this tab’s business', async () => {
    renderDirect([
      grantRow({ id: 'd1', subject: { kind: 'user', userId: 'u1' } }),
      grantRow({
        id: 's1',
        shareId: 'share-9',
        active: false,
        subject: { kind: 'user', userId: 'u2' },
      }),
    ])

    await screen.findByLabelText('access.permissionFor:{"name":"name:u1"}')
    expect(screen.queryByText('access.revokedTitle')).toBeNull()
  })

  it('still shows everything when NOT direct-only (the §4 entry point)', async () => {
    renderSheet([
      grantRow({
        shareId: 'share-9',
        subject: { kind: 'user', userId: 'u2' },
      }),
    ])

    expect(await screen.findByText('access.manageBundle')).toBeTruthy()
  })
})
