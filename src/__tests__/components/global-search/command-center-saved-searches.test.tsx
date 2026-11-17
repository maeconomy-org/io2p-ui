import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns?: string) => (key: string, values?: Record<string, string>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? ` ${Object.values(values).join(' ')}` : ''}`,
}))
vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useGet: () => ({ data: undefined, isError: false }) }),
}))
vi.mock('@/hooks/api/leaves', () => ({ useUnits: () => ({ data: [] }) }))
vi.mock('@/hooks/api/users', () => ({
  useUserSearch: () => ({ users: [], error: null }),
}))
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

// A small node: `/me` reads `server`, the PATCH merges into it.
type Bag = Record<string, Record<string, unknown>>
let server: Bag
const me = vi.fn()
const updatePreferences = vi.fn()
const merge = (patch: Bag) => {
  for (const [ns, bag] of Object.entries(patch)) {
    const next = { ...server[ns] }
    for (const [k, v] of Object.entries(bag)) {
      if (v === null) delete next[k]
      else next[k] = v
    }
    server[ns] = next
  }
  return structuredClone(server)
}

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))
vi.mock('@/contexts/auth-context', async () => {
  const { useQuery } = await import('@tanstack/react-query')
  const { queryKeys } = await import('@/lib/query-keys')
  return {
    useAuth: () => {
      const { data, isPending } = useQuery({
        queryKey: queryKeys.users.current,
        queryFn: () => me(),
        staleTime: Infinity,
      })
      return {
        preferences: (data as { preferences?: Bag } | undefined)?.preferences,
        authLoading: isPending,
        isAuthenticated: true,
      }
    },
  }
})

import { CommandCenter } from '@/components/global-search/command-center'
import { queryKeys } from '@/lib/query-keys'

const entry = (name: string, query: string, createdAt: number) => ({
  name,
  query,
  createdAt,
})

const input = () =>
  screen.getByPlaceholderText('commandCenter.placeholder') as HTMLInputElement
const saveButton = () => screen.getByTestId('save-search')
const nameField = () =>
  screen.getByLabelText('savedSearch.nameLabel') as HTMLInputElement
const notice = () => screen.getByTestId('search-notice')
const patchedKeys = () =>
  updatePreferences.mock.calls.map(([p]) => Object.keys(p.search)[0])

const setup = async (
  props: Partial<React.ComponentProps<typeof CommandCenter>> = {}
) => {
  const onOpenChange = vi.fn()
  const user = userEvent.setup()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CommandCenter open onOpenChange={onOpenChange} {...props} />
    </QueryClientProvider>
  )
  await waitFor(() => expect(input()).toHaveFocus())
  const rerender = (
    next: Partial<React.ComponentProps<typeof CommandCenter>>
  ) =>
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <CommandCenter open onOpenChange={onOpenChange} {...props} {...next} />
      </QueryClientProvider>
    )
  return { user, onOpenChange, rerender, queryClient }
}

describe('CommandCenter saved searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    server = { ui: { theme: 'light' }, search: {} }
    me.mockImplementation(async () => ({
      id: 'user-a',
      preferences: structuredClone(server),
    }))
    updatePreferences.mockImplementation(async (patch: Bag) => merge(patch))
  })

  it('saves with the keyboard only and gives focus back to the input', async () => {
    const { user, onOpenChange } = await setup({
      initialQuery: 'beton mass>=2t',
    })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.tab()
    await user.tab()
    expect(saveButton()).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(nameField()).toHaveFocus()
    expect(nameField().value).toBe('beton mass>=2t')
    await user.keyboard('Heavy{Enter}')

    await waitFor(() =>
      expect(notice()).toHaveTextContent('savedSearch.savedAs Heavy')
    )
    expect(server.search).toMatchObject({
      [patchedKeys()[0]]: { name: 'Heavy', query: 'beton mass>=2t' },
    })
    expect(input()).toHaveFocus()
    expect(screen.queryByTestId('save-search-form')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(localStorage.getItem('iom-recent-searches')).toBeNull()
  })

  it('keeps Save off until the preferences have loaded', async () => {
    let answer!: (v: unknown) => void
    me.mockReturnValue(new Promise((r) => (answer = r)))
    const { user } = await setup({ initialQuery: 'beton' })
    expect(saveButton()).toBeDisabled()
    answer({ id: 'user-a', preferences: server })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    expect(nameField()).toBeInTheDocument()
  })

  it('closes only the save row on Escape, then the dialog', async () => {
    const { user, onOpenChange } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    expect(saveButton()).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('save-search-form')).toBeNull()
    expect(saveButton()).toHaveFocus()
    expect(onOpenChange).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('never shows the save row and the filter panel together', async () => {
    const { user } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.click(screen.getByTestId('add-filter'))
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('save-search-form')).toBeNull()
    await user.click(saveButton())
    expect(screen.getByTestId('save-search-form')).toBeInTheDocument()
    expect(screen.queryByTestId('filter-panel')).toBeNull()
  })

  it('still searches on Enter in the main input while the row is open', async () => {
    const onSearch = vi.fn()
    const { user } = await setup({ initialQuery: 'beton', onSearch })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.click(input())
    await user.keyboard('{Enter}')
    expect(onSearch).toHaveBeenCalled()
    expect(updatePreferences).not.toHaveBeenCalled()
  })

  it('sends one PATCH for two submits while the first runs', async () => {
    let answer!: () => void
    updatePreferences.mockImplementation(
      (patch: Bag) => new Promise((r) => (answer = () => r(merge(patch))))
    )
    const { user } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.keyboard('{Enter}')
    await waitFor(() => expect(updatePreferences).toHaveBeenCalledTimes(1))
    const submit = screen.getByRole('button', { name: 'savedSearch.saving' })
    expect(submit).toHaveAttribute('aria-busy', 'true')
    await user.keyboard('{Enter}')
    await user.click(submit)
    answer()
    await waitFor(() =>
      expect(notice()).toHaveTextContent('savedSearch.savedAs')
    )
    expect(updatePreferences).toHaveBeenCalledTimes(1)
  })

  it('uses the same key again on a retry after no answer', async () => {
    updatePreferences.mockRejectedValueOnce({ status: 0, name: 'TimeoutError' })
    const { user } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'savedSearch.reason.offline'
      )
    )
    await user.keyboard('{Enter}')
    await waitFor(() => expect(updatePreferences).toHaveBeenCalledTimes(2))
    expect(patchedKeys()[1]).toBe(patchedKeys()[0])
  })

  it('announces a refused save, with the node text marked as English', async () => {
    updatePreferences.mockRejectedValueOnce({
      status: 422,
      detail: 'Invalid preferences: preferences total 70000 bytes, max 65536',
    })
    const { user } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.keyboard('{Enter}')
    const alert = await screen.findByText(/preferences total 70000/)
    expect(alert).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'savedSearch.reason.refused'
    )
    expect(nameField()).toHaveAttribute('aria-invalid', 'true')
    expect(nameField()).toHaveFocus()
  })

  it('keeps Save open on a full list and says why', async () => {
    server.search = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [
        `s-${i}`,
        entry(`n${i}`, `q${i}`, i),
      ])
    )
    const { user } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'savedSearch.reason.full'
    )
    expect(updatePreferences).not.toHaveBeenCalled()
  })

  it('shows a failure as a toast when the dialog closed meanwhile', async () => {
    let fail!: () => void
    updatePreferences.mockImplementation(
      () => new Promise((_, reject) => (fail = () => reject({ status: 500 })))
    )
    const { user, rerender } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await user.keyboard('{Enter}')
    await waitFor(() => expect(updatePreferences).toHaveBeenCalled())
    rerender({ open: false })
    fail()
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('savedSearch.reason.failed')
    )
  })

  it('runs a saved search by putting its text in the input', async () => {
    server.search = { 's-a': entry('Heavy', 'beton mass>=2t', 2) }
    const { user } = await setup()
    const group = await screen.findByTestId('saved-searches')
    await user.click(within(group).getByText('Heavy'))
    expect(input().value).toBe('beton mass>=2t')
    expect(input()).toHaveFocus()
  })

  it('lists the saved group above Recent, newest first', async () => {
    localStorage.setItem('iom-recent-searches', JSON.stringify(['hout']))
    server.search = {
      's-a': entry('Old', 'a', 1),
      's-b': entry('New', 'b', 2),
    }
    await setup()
    const group = await screen.findByTestId('saved-searches')
    const names = within(group)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(names).toEqual(['Newb', 'Olda'])
    const recent = screen.getByText('commandCenter.recent')
    expect(
      group.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('deletes with a named button that Tab reaches', async () => {
    server.search = { 's-a': entry('Heavy', 'beton', 2) }
    const { user } = await setup()
    await screen.findByTestId('saved-searches')
    const remove = () =>
      screen.getByRole('button', { name: 'savedSearch.delete Heavy' })
    // The filter suggestions of an empty input come first.
    for (let i = 0; i < 20 && document.activeElement !== remove(); i++) {
      await user.tab()
    }
    expect(remove()).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.queryByTestId('saved-searches')).toBeNull()
    )
    expect(updatePreferences).toHaveBeenCalledWith({ search: { 's-a': null } })
    expect(notice()).toHaveTextContent('savedSearch.deleted')
    expect(input()).toHaveFocus()
  })

  it('says why a delete failed', async () => {
    server.search = { 's-a': entry('Heavy', 'beton', 2) }
    updatePreferences.mockRejectedValueOnce({ status: 500 })
    const { user } = await setup()
    await screen.findByTestId('saved-searches')
    await user.click(
      screen.getByRole('button', { name: 'savedSearch.delete Heavy' })
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'savedSearch.reason.deleteFailed'
      )
    )
  })

  it('shows 8 rows, then all of them on Show all', async () => {
    server.search = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        `s-${i}`,
        entry(`n${i}`, `q${i}`, i),
      ])
    )
    const { user } = await setup()
    const group = await screen.findByTestId('saved-searches')
    expect(within(group).getAllByRole('listitem')).toHaveLength(8)
    await user.click(within(group).getByText('savedSearch.showAll 10'))
    expect(within(group).getAllByRole('listitem')).toHaveLength(10)
  })

  it('lets the user delete an unreadable entry', async () => {
    server.search = { 's-bad': { name: 1 } }
    const { user } = await setup()
    await screen.findByText('savedSearch.unreadable')
    await user.click(
      screen.getByRole('button', { name: 'savedSearch.deleteUnreadable' })
    )
    await waitFor(() => expect(server.search).toEqual({}))
  })

  it('keeps a new row when a /me that started before the save answers last', async () => {
    const { user, queryClient } = await setup({ initialQuery: 'beton' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    const old = structuredClone(server)
    let lateAnswer: (() => void) | undefined
    me.mockImplementationOnce(
      () =>
        new Promise(
          (r) => (lateAnswer = () => r({ id: 'user-a', preferences: old }))
        )
    )
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.current })
    await waitFor(() => expect(lateAnswer).toBeDefined())

    await user.click(saveButton())
    await user.keyboard('Heavy{Enter}')
    await waitFor(() =>
      expect(notice()).toHaveTextContent('savedSearch.savedAs Heavy')
    )
    await waitFor(() =>
      expect(notice()).toHaveTextContent('savedSearch.savedAs Heavy')
    )
    lateAnswer!()
    await user.clear(input())
    const group = await screen.findByTestId('saved-searches')
    await waitFor(() =>
      expect(within(group).getByText('Heavy')).toBeInTheDocument()
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(
      within(screen.getByTestId('saved-searches')).getByText('Heavy')
    ).toBeInTheDocument()
  })
})
