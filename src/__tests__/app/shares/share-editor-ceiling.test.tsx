import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ShareDTO } from 'io2p-client'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

const { create, noList, objectsList } = vi.hoisted(() => ({
  create: vi.fn(async (_: unknown) => ({})),
  noList: () => ({
    useList: () => ({ data: undefined, isFetching: false }),
  }),
  objectsList: { data: undefined as unknown },
}))
vi.mock('@/hooks/api/access', () => ({
  useShares: () => ({
    useCreate: () => ({ mutateAsync: create }),
    useUpdate: () => ({ mutateAsync: vi.fn() }),
  }),
}))
vi.mock('@/hooks/api/users', () => ({
  useUserSearch: () => ({
    users: [{ id: 'anna', displayName: 'Anna', email: 'anna@example.com' }],
    isFetching: false,
  }),
}))
vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({
    useList: () => ({ data: objectsList.data, isFetching: false }),
  }),
  useProcesses: noList,
  useTemplates: noList,
}))
vi.mock('@/hooks/api/leaves', () => ({
  useConstants: noList,
  useFormulas: noList,
}))

import { ResourcePicker } from '@/app/shares/components/resource-picker'
import { ShareEditorSheet } from '@/app/shares/components/share-editor-sheet'

const object = (id: string, permission: string) => ({
  id,
  name: `Wall ${id}`,
  createdBy: 'them',
  permission,
})

const annaSelect = () =>
  screen.getByRole('combobox', {
    name: 'access.permissionFor:{"name":"Anna"}',
  })

async function pick(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(screen.getByTestId('resource-picker'))
  await user.click(screen.getByTestId(`resource-option-${id}`))
}

async function chooseLevel(
  user: ReturnType<typeof userEvent.setup>,
  level: string
) {
  await user.click(annaSelect())
  // An option's text is its label followed by its hint.
  const option = screen
    .getAllByRole('option')
    .find((o) => o.textContent?.startsWith(`access.permission.${level}`))
  await user.click(option!)
}

const savedShare = (permission: string) =>
  ({
    id: 's1',
    name: 'Walls',
    members: [{ userId: 'anna', name: 'Anna', permission }],
    resources: [{ type: 'object', id: 'o1', name: 'Wall o1' }],
  }) as unknown as ShareDTO

describe('share editor member levels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    objectsList.data = {
      data: [object('o1', 'admin'), object('o2', 'share')],
    }
  })

  // The node grants a bundle only when the granter holds the strongest member level on every
  // resource. The order a control-only guard misses: a member set to admin, THEN an item held
  // at share.
  it('limits a member to the weakest level held, and saves that level', async () => {
    render(<ShareEditorSheet open onOpenChange={vi.fn()} mode="create" />)
    const user = userEvent.setup()
    await user.type(screen.getByTestId('share-name'), 'Walls')
    await pick(user, 'o1')
    await user.click(screen.getByTestId('member-picker'))
    await user.click(screen.getByTestId('member-option-anna'))
    await chooseLevel(user, 'admin')
    expect(screen.queryByTestId('share-member-ceiling')).toBeNull()

    await pick(user, 'o2')

    expect(screen.getByTestId('share-member-ceiling')).toBeInTheDocument()
    expect(annaSelect()).toHaveTextContent('access.permission.share')
    await user.click(annaSelect())
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options.some((o) => o?.includes('access.permission.admin'))).toBe(
      false
    )
    await user.keyboard('{Escape}')

    await user.click(screen.getByTestId('share-save'))
    expect(create).toHaveBeenCalledWith({
      body: expect.objectContaining({
        members: [{ userId: 'anna', permission: 'share' }],
      }),
    })
  })

  it('warns that saving an edit lowers people saved above the limit', async () => {
    render(
      <ShareEditorSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        share={savedShare('admin')}
      />
    )
    expect(screen.queryByTestId('share-member-lowered')).toBeNull()

    await pick(userEvent.setup(), 'o2')

    expect(screen.getByTestId('share-member-lowered')).toHaveTextContent(
      'shares.memberLoweredHint:{"count":1,"level":"access.permission.share"}'
    )
  })

  // Raised in this edit, then capped back: the saved level does not change, so nothing is lowered.
  it('does not warn about a member only returned to the saved level', async () => {
    render(
      <ShareEditorSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        share={savedShare('share')}
      />
    )
    const user = userEvent.setup()
    await chooseLevel(user, 'admin')
    await pick(user, 'o2')

    expect(screen.getByTestId('share-member-ceiling')).toBeInTheDocument()
    expect(screen.queryByTestId('share-member-lowered')).toBeNull()
  })
})

describe('share resource picker', () => {
  beforeEach(() => vi.clearAllMocks())

  // The ceiling is only as good as the level each picked resource carries.
  it('picks a resource with the level the viewer holds on it', async () => {
    objectsList.data = { data: [object('o1', 'share')] }
    const onAdd = vi.fn()
    render(
      <ResourcePicker selectedIds={new Set()} family={null} onAdd={onAdd} />
    )
    await pick(userEvent.setup(), 'o1')

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1', permission: 'share' })
    )
  })

  it('will not add a resource held below share, and says why', async () => {
    objectsList.data = { data: [object('o1', 'write')] }
    const onAdd = vi.fn()
    render(
      <ResourcePicker selectedIds={new Set()} family={null} onAdd={onAdd} />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('resource-picker'))
    const option = screen.getByTestId('resource-option-o1')
    expect(option).toHaveTextContent('shares.needsShareAccess')
    await user.click(option)

    expect(onAdd).not.toHaveBeenCalled()
  })
})
