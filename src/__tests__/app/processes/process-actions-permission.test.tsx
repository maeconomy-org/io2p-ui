// The row menu narrows to the rungs the node guards each action with. `createdBy` used to gate
// Share, which denied an admin grantee a control the node would have allowed.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProcessListItem } from 'io2p-client'

const authState = { userId: 'me', authLoading: false }
vi.mock('@/contexts', () => ({ useAuth: () => authState }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { buildProcessColumns } from '@/app/processes/components/process-columns'

const actions = {
  onViewDetails: vi.fn(),
  onEdit: vi.fn(),
  onShare: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
}

const row = (over: Partial<ProcessListItem> = {}) =>
  ({
    id: 'p-1',
    name: 'Mixing',
    createdBy: 'them',
    deleted: false,
    ...over,
  }) as ProcessListItem

// The actions cell is the last column; render it the way the table would.
const renderCell = (process: ProcessListItem) => {
  const columns = buildProcessColumns({
    t: (key: string) => key,
    actions,
    currentUserId: 'me',
  })
  const cell = columns.at(-1)!.cell as (ctx: unknown) => React.ReactNode
  render(<>{cell({ row: { original: process } })}</>)
}

const openMenu = async (process: ProcessListItem) => {
  renderCell(process)
  await userEvent.setup().click(screen.getByTestId('process-actions-dropdown'))
}

describe('process row actions against the ladder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.userId = 'me'
    authState.authLoading = false
  })

  it('drops the menu entirely for a read-only viewer', () => {
    // With no action left, EntityActionsCell omits the trigger rather than opening an empty menu.
    renderCell(row({ permission: 'read' }))
    expect(screen.queryByTestId('process-actions-dropdown')).toBeNull()
    expect(screen.getByTestId('process-details-button')).toBeInTheDocument()
  })

  it('lets a write grantee edit, but not share or delete', async () => {
    await openMenu(row({ permission: 'write' }))
    expect(screen.getByTestId('process-action-edit')).toBeInTheDocument()
    expect(screen.queryByTestId('process-action-share')).toBeNull()
    expect(screen.queryByTestId('process-action-delete')).toBeNull()
  })

  it('offers share to a share grantee, who is not the author', async () => {
    // The bug this closes: `createdBy === userId` denied this row's Share entirely.
    await openMenu(row({ permission: 'share' }))
    expect(screen.getByTestId('process-action-share')).toBeInTheDocument()
    expect(screen.queryByTestId('process-action-delete')).toBeNull()
  })

  it('gives an admin grantee delete as well', async () => {
    await openMenu(row({ permission: 'admin' }))
    expect(screen.getByTestId('process-action-delete')).toBeInTheDocument()
    expect(screen.getByTestId('process-action-share')).toBeInTheDocument()
  })

  it('treats the author as admin when the node sent no verdict', async () => {
    await openMenu(row({ createdBy: 'me' }))
    expect(screen.getByTestId('process-action-delete')).toBeInTheDocument()
  })
})
