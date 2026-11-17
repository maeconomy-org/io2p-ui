import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns?: string) => (key: string, values?: Record<string, string>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? ` ${Object.values(values).join(' ')}` : ''}`,
}))

const FOLDER = '0193a5c0-7d1e-7000-8000-000000000001'
const getObject = vi.fn()

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useGet: (id: string) => getObject(id) }),
}))
vi.mock('@/hooks/api/leaves', () => ({
  useUnits: () => ({ data: [{ symbol: 't' }, { symbol: 'kg' }] }),
}))
vi.mock('@/hooks/api/users', () => ({
  useUserSearch: () => ({ users: [], error: null }),
}))
vi.mock('@/components/entity-sheet/fields/object-picker', () => ({
  ObjectPicker: ({
    onSelect,
  }: {
    onSelect: (id: string, name: string) => void
  }) => (
    <button type="button" onClick={() => onSelect(FOLDER, 'Hal A')}>
      pick folder
    </button>
  ),
}))

import { CommandCenter } from '@/components/global-search/command-center'

const input = () =>
  screen.getByPlaceholderText('commandCenter.placeholder') as HTMLInputElement
const addFilter = () => screen.getByTestId('add-filter')

// The dialog moves focus to the input 50 ms after it opens.
const setup = async (
  props: Partial<React.ComponentProps<typeof CommandCenter>> = {}
) => {
  const onOpenChange = vi.fn()
  const user = userEvent.setup()
  render(<CommandCenter open onOpenChange={onOpenChange} {...props} />)
  await waitFor(() => expect(input()).toHaveFocus())
  return { user, onOpenChange }
}

describe('CommandCenter filter panel', () => {
  it('lets Tab leave an empty input without changing it', async () => {
    const { user } = await setup()
    await user.tab()
    expect(input().value).toBe('')
    expect(input()).not.toHaveFocus()
  })

  it('still completes a filter name that is being typed', async () => {
    const { user } = await setup()
    await user.type(input(), 'del')
    await user.tab()
    expect(input().value).toBe('deleted:')
  })

  it('never completes on Shift+Tab', async () => {
    const { user } = await setup()
    await user.type(input(), 'del')
    await user.tab({ shift: true })
    expect(input().value).toBe('del')
  })

  it('writes the filters into the search box on Apply, and moves focus there', async () => {
    const { user } = await setup({ initialQuery: 'beton' })
    await user.click(addFilter())
    expect(addFilter()).toHaveAttribute('aria-expanded', 'true')
    await user.type(screen.getByLabelText('filterPanel.numberKey'), 'mass')
    await user.type(screen.getByLabelText('filterPanel.numberFrom'), '2')
    await user.type(screen.getByLabelText('filterPanel.numberUnit'), 't')
    await user.keyboard('{Enter}')

    expect(input().value).toBe('beton mass>=2t')
    expect(input()).toHaveFocus()
    expect(screen.queryByTestId('filter-panel')).toBeNull()
  })

  it('shows the error beside the field and applies nothing', async () => {
    const { user } = await setup()
    await user.click(addFilter())
    await user.type(screen.getByLabelText('filterPanel.numberFrom'), '2')
    await user.click(screen.getByRole('button', { name: 'filterPanel.apply' }))

    const key = screen.getByLabelText('filterPanel.numberKey')
    expect(key).toHaveAttribute('aria-invalid', 'true')
    expect(key).toHaveFocus()
    expect(screen.getByText('filterPanel.error.numberKey')).toBeInTheDocument()
    expect(input().value).toBe('')
  })

  it('closes only the panel on Escape, then the dialog on a second one', async () => {
    const { user, onOpenChange } = await setup()
    await user.click(addFilter())
    await user.click(screen.getByLabelText('filterPanel.numberKey'))
    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('filter-panel')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(addFilter()).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes only an open picker on Escape inside the panel', async () => {
    const { user, onOpenChange } = await setup()
    await user.click(addFilter())
    await user.click(
      screen.getByRole('combobox', { name: 'filterPanel.createdBy' })
    )
    expect(
      screen.getByPlaceholderText('filterPanel.findPerson')
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.queryByPlaceholderText('filterPanel.findPerson')).toBeNull()
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('offers numbers, dates and folder for objects only', async () => {
    const { user } = await setup({ listType: 'processes' })
    await user.click(addFilter())
    expect(screen.queryByLabelText('filterPanel.numberKey')).toBeNull()
    expect(screen.queryByText('filterPanel.folder')).toBeNull()
    expect(screen.getByLabelText('filterPanel.propertyKey')).toBeInTheDocument()
  })

  it('names a folder pill by the folder, and says so when it cannot', async () => {
    getObject.mockReturnValue({ data: { name: 'Hal A' }, isError: false })
    await setup({ initialQuery: `in:${FOLDER}` })
    expect(screen.getByText('search.pill.folder Hal A')).toBeInTheDocument()
  })

  it('says a folder is not available when it cannot be read', async () => {
    getObject.mockReturnValue({ data: undefined, isError: true })
    await setup({ initialQuery: `in:${FOLDER}` })
    expect(screen.getByText('search.pill.folderMissing')).toBeInTheDocument()
  })

  it('gives each pill a remove button with a name', async () => {
    const { user } = await setup({ initialQuery: 'mass>2t deleted:all' })
    expect(screen.getByText('search.pill.deleted.all')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'search.pill.remove mass≥2t' })
    )
    expect(input().value).toBe('deleted:all')
  })

  it('names the remove button of a folder pill by the folder', async () => {
    getObject.mockReturnValue({ data: { name: 'Hal A' }, isError: false })
    await setup({ initialQuery: `in:${FOLDER}` })
    expect(
      screen.getByRole('button', {
        name: 'search.pill.remove search.pill.folder Hal A',
      })
    ).toBeInTheDocument()
  })

  it('keeps a filter typed while the panel is open', async () => {
    const { user } = await setup({ initialQuery: 'deleted:false' })
    await user.click(addFilter())
    await user.clear(input())
    await user.type(input(), 'deleted:true mass>=5')
    await user.type(screen.getByLabelText('filterPanel.propertyKey'), 'a')
    await user.click(screen.getByRole('button', { name: 'filterPanel.apply' }))

    expect(input().value).toBe('deleted:true mass≥5 prop:a')
  })

  it('replaces a kind the user edited in the panel', async () => {
    const { user } = await setup({ initialQuery: 'deleted:false beton' })
    await user.click(addFilter())
    await user.selectOptions(
      screen.getByLabelText('filterPanel.deleted'),
      'all'
    )
    await user.click(screen.getByRole('button', { name: 'filterPanel.apply' }))

    expect(input().value).toBe('beton deleted:all')
  })

  it('forgets the arrow choice when the text changes', async () => {
    const { user } = await setup()
    await user.keyboard('{ArrowDown}')
    await user.type(input(), 'steel ')
    await user.tab()
    expect(input().value).toBe('steel ')
    expect(input()).not.toHaveFocus()
  })

  it('completes the suggestion the arrows moved to, also on an empty input', async () => {
    const { user } = await setup()
    await user.keyboard('{ArrowDown}')
    await user.tab()
    expect(input().value).toMatch(/^\w+:$/)
    expect(input()).toHaveFocus()
  })
})
