// The row menu narrows to the rungs the node guards each action with, rather than being present or
// absent as a whole.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ObjectListItem } from 'io2p-client'

const authState = { userId: 'me' }
vi.mock('@/contexts', () => ({ useAuth: () => authState }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ObjectActionsCell } from '@/app/objects/components/object-actions-cell'

const actions = {
  onViewDetails: vi.fn(),
  onShowQRCode: vi.fn(),
  onDuplicate: vi.fn(),
  onCreateTemplate: vi.fn(),
  onShare: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
}

const row = (over: Partial<ObjectListItem> = {}) =>
  ({
    id: 'o-1',
    name: 'Wall A',
    createdBy: 'them',
    deleted: false,
    ...over,
  }) as ObjectListItem

// userEvent, not fireEvent: Radix opens the menu on a full pointer sequence.
const openMenu = async (object: ObjectListItem) => {
  const user = userEvent.setup()
  render(<ObjectActionsCell object={object} actions={actions} />)
  await user.click(screen.getByTestId('object-actions-dropdown'))
}

describe('object row actions against the ladder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.userId = 'me'
  })

  it('offers a read-only viewer nothing that writes this object', async () => {
    await openMenu(row({ permission: 'read' }))
    expect(screen.queryByTestId('object-action-delete')).toBeNull()
    expect(screen.queryByTestId('object-action-share')).toBeNull()
    // Duplicating READS this object and writes a new one the viewer will own.
    expect(screen.getByTestId('object-action-duplicate')).toBeInTheDocument()
  })

  it('withholds delete from a write grantee, which the node guards at admin', async () => {
    await openMenu(row({ permission: 'write' }))
    expect(screen.queryByTestId('object-action-delete')).toBeNull()
    expect(screen.queryByTestId('object-action-share')).toBeNull()
  })

  it('offers share at the share rung, still without delete', async () => {
    await openMenu(row({ permission: 'share' }))
    expect(screen.getByTestId('object-action-share')).toBeInTheDocument()
    expect(screen.queryByTestId('object-action-delete')).toBeNull()
  })

  it('gives an admin grantee delete as well', async () => {
    await openMenu(row({ permission: 'admin' }))
    expect(screen.getByTestId('object-action-delete')).toBeInTheDocument()
    expect(screen.getByTestId('object-action-share')).toBeInTheDocument()
  })

  it('treats the author as admin when the node sent no verdict', async () => {
    await openMenu(row({ createdBy: 'me' }))
    expect(screen.getByTestId('object-action-delete')).toBeInTheDocument()
  })
})
