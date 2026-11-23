import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useFormatter: () => ({
    dateTime: (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  }),
  useTranslations:
    (ns?: string) => (key: string, values?: Record<string, string>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? ` ${Object.values(values).join(' ')}` : ''}`,
}))
vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useGet: () => ({ data: undefined, isError: false }) }),
}))
vi.mock('@/hooks/api/leaves', () => ({
  useUnits: () => ({
    data: [
      { symbol: 't', dimension: 'mass' },
      { symbol: 'kg', dimension: 'mass' },
      { symbol: 'km', dimension: 'length' },
    ],
  }),
}))
vi.mock('@/hooks/api/users', () => ({
  useUserSearch: () => ({ users: [], error: null }),
}))
vi.mock('@/components/entity-sheet/fields/object-picker', () => ({
  ObjectPicker: () => <button type="button">pick folder</button>,
}))

const remove = vi.fn(async () => ({ ok: true as const }))
const SAVED = [
  { key: 'k1', name: 'Steel', query: 'prop:material=steel', createdAt: 1 },
]
vi.mock('@/hooks/ui/use-saved-searches', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSavedSearches: () => ({
    ready: true,
    saved: SAVED,
    unreadable: [],
    save: vi.fn(),
    remove,
    pending: false,
  }),
}))

import { CommandCenter } from '@/components/global-search/command-center'
import { FILTER_SUGGESTIONS } from '@/components/global-search/search-parser'

const input = () =>
  screen.getByPlaceholderText('commandCenter.placeholder') as HTMLInputElement
const addFilter = () => screen.getByTestId('add-filter')
const apply = () => screen.getByRole('button', { name: 'filterPanel.apply' })
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

const setup = async (
  props: Partial<React.ComponentProps<typeof CommandCenter>> = {}
) => {
  const onOpenChange = vi.fn()
  const onSearch = vi.fn()
  const user = userEvent.setup()
  render(
    <CommandCenter
      open
      onOpenChange={onOpenChange}
      onSearch={onSearch}
      {...props}
    />
  )
  await waitFor(() => expect(input()).toHaveFocus())
  return { user, onOpenChange, onSearch }
}

const openCreated = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(addFilter())
  await user.click(screen.getByRole('button', { name: /filterPanel\.created/ }))
}
const day = (iso: string) =>
  document.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`)!

beforeEach(() => {
  remove.mockClear()
  localStorage.clear()
})

describe('the filter panel applies and searches', () => {
  it('FP1 runs the search on Apply and keeps the dialog open', async () => {
    const { user, onSearch, onOpenChange } = await setup()
    await user.click(addFilter())
    await user.type(screen.getByLabelText('filterPanel.numberKey'), 'mass')
    await user.type(screen.getByLabelText('filterPanel.numberFrom'), '2')
    await user.click(apply())

    expect(input().value).toBe('mass>=2')
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(input()).toHaveFocus()
  })

  it('FP2 applies on Enter in a panel field', async () => {
    const { user, onSearch } = await setup()
    await user.click(addFilter())
    await user.type(screen.getByLabelText('filterPanel.numberKey'), 'mass')
    await user.type(screen.getByLabelText('filterPanel.numberTo'), '5{Enter}')

    expect(input().value).toBe('mass<=5')
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('FP3 applies nothing and searches nothing when a field is wrong', async () => {
    const { user, onSearch } = await setup()
    await user.click(addFilter())
    await user.type(screen.getByLabelText('filterPanel.numberFrom'), '2')
    await user.click(apply())

    expect(screen.getByText('filterPanel.error.numberKey')).toBeInTheDocument()
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('a property typed alone is not dropped by Enter in the search box', async () => {
    const { user, onSearch } = await setup()
    await user.click(addFilter())
    await user.type(screen.getByLabelText('filterPanel.propertyKey'), 'colour')
    await user.click(input())
    await user.keyboard('{Enter}')

    expect(input().value).toBe('prop:colour')
    expect(onSearch).toHaveBeenCalledTimes(1)
  })
})

describe('the date field', () => {
  it('FP4 writes the two days picked in the calendar', async () => {
    const { user } = await setup()
    await openCreated(user)
    await user.click(day(`${thisMonth}-12`))
    await user.click(day(`${thisMonth}-10`))
    await user.click(screen.getByRole('button', { name: 'filterPanel.done' }))
    await user.click(apply())

    expect(input().value).toBe(`created:${thisMonth}-10..${thisMonth}-12`)
  })

  it('FP5 reads one picked day as from that day', async () => {
    const { user } = await setup()
    await openCreated(user)
    await user.click(day(`${thisMonth}-10`))
    await user.click(screen.getByRole('button', { name: 'filterPanel.done' }))
    await user.click(apply())

    expect(input().value).toBe(`created:${thisMonth}-10..`)
  })

  it('FP6 writes a preset range', async () => {
    const { user } = await setup()
    await openCreated(user)
    await user.click(
      screen.getByRole('button', { name: 'filterPanel.preset.thisYear' })
    )
    await user.click(apply())

    const y = now.getFullYear()
    expect(input().value).toBe(`created:${y}-01-01..${y}-12-31`)
  })

  it('FP7 Clear removes the date filter', async () => {
    const { user } = await setup({
      initialQuery: 'created:2026-01-01..2026-02-01 beton',
    })
    await openCreated(user)
    await user.click(screen.getByRole('button', { name: 'filterPanel.clear' }))
    await user.click(apply())

    expect(input().value).toBe('beton')
  })
})

describe('date pills read as days', () => {
  it('shows a range as two days', async () => {
    await setup({ initialQuery: 'created:2026-01-01..2026-12-31 ' })
    expect(
      screen.getByText('search.pill.created 2026-01-01 – 2026-12-31')
    ).toBeInTheDocument()
  })

  it('shows an open range from its first day', async () => {
    await setup({ initialQuery: 'updated:2026-03-01.. ' })
    expect(
      screen.getByText('search.pill.updated search.pill.rangeFrom 2026-03-01')
    ).toBeInTheDocument()
  })

  it('shows a range open at the start until its last day', async () => {
    await setup({ initialQuery: 'created:..2026-03-01 ' })
    expect(
      screen.getByText('search.pill.created search.pill.rangeUntil 2026-03-01')
    ).toBeInTheDocument()
  })
})

describe('pills open the panel at their field', () => {
  it('FP9 a property pill changes that property only', async () => {
    const { user } = await setup({
      initialQuery: 'prop:colour=red prop:size=big beton',
    })
    await user.click(screen.getByRole('button', { name: 'colour: red' }))

    const value = screen.getByLabelText('filterPanel.propertyValue')
    expect(screen.getByLabelText('filterPanel.propertyKey')).toHaveValue(
      'colour'
    )
    expect(value).toHaveValue('red')
    await user.clear(value)
    await user.type(value, 'blue')
    await user.click(apply())

    expect(input().value).toBe('prop:size=big beton prop:colour=blue')
  })

  it('FP10 a number pill focuses the filled number field', async () => {
    const { user } = await setup({ initialQuery: 'mass>=2t ' })
    await user.click(screen.getByRole('button', { name: 'mass≥2t' }))

    const key = screen.getByLabelText('filterPanel.numberKey')
    await waitFor(() => expect(key).toHaveFocus())
    expect(key).toHaveValue('mass')
  })
})

describe('unit suggestions', () => {
  it('FP11 offers the units that start with the typed text', async () => {
    const { user } = await setup()
    await user.click(addFilter())
    const unit = screen.getByLabelText('filterPanel.numberUnit')
    await user.type(unit, 'k')

    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['kgmass', 'kmlength'])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(unit).toHaveValue('km')
  })
})

describe('suggestions', () => {
  it('SG1 lists every filter on objects, with no id as an example', async () => {
    await setup()
    for (const s of FILTER_SUGGESTIONS) {
      expect(
        screen.getByTestId(`search-suggestion-${s.type}`)
      ).toBeInTheDocument()
    }
    for (const type of ['createdBy', 'folder', 'parent']) {
      expect(
        screen.getByTestId(`search-suggestion-${type}`).querySelector('code')
      ).toBeNull()
    }
  })

  it('FP12 leaves numbers, dates and folder out on another list', async () => {
    await setup({ listType: 'processes' })
    for (const type of ['number', 'created', 'updated', 'folder']) {
      expect(screen.queryByTestId(`search-suggestion-${type}`)).toBeNull()
    }
    expect(screen.getByTestId('search-suggestion-property')).toBeInTheDocument()
  })

  it('SG2 Created by opens the panel at the person picker', async () => {
    const { user } = await setup()
    await user.click(screen.getByTestId('search-suggestion-createdBy'))

    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'filterPanel.createdBy' })
      ).toHaveFocus()
    )
  })
})

describe('one arrow order over all rows', () => {
  const toSaved = FILTER_SUGGESTIONS.length

  it('KB1 reaches a saved search after the suggestions, and Enter runs it', async () => {
    const { user } = await setup()
    await user.keyboard('{ArrowDown}'.repeat(toSaved))
    await user.keyboard('{Enter}')

    expect(input().value).toBe('prop:material=steel')
  })

  it('KB2 Enter on a recent search puts its text in the box', async () => {
    localStorage.setItem('iom-recent-searches', JSON.stringify(['beton']))
    const { user } = await setup()
    await user.keyboard('{ArrowDown}'.repeat(toSaved + 1))
    await user.keyboard('{Enter}')

    expect(input().value).toBe('beton')
  })

  it('KB3 Enter without arrow moves searches', async () => {
    const { user, onSearch } = await setup()
    await user.type(input(), 'beton{Enter}')

    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('KB4 Delete removes the highlighted saved search', async () => {
    const { user } = await setup()
    await user.keyboard('{ArrowDown}'.repeat(toSaved))
    await user.keyboard('{Delete}')

    expect(remove).toHaveBeenCalledWith('k1')
  })

  it('KB5 Tab never completes a saved row', async () => {
    const { user } = await setup()
    await user.keyboard('{ArrowDown}'.repeat(toSaved))
    await user.keyboard('{Tab}')

    // Tab moves on, as on any row that is not a suggestion.
    expect(input().value).toBe('')
    expect(input()).not.toHaveFocus()
  })

  it('marks the highlighted row for screen readers', async () => {
    const { user } = await setup()
    await user.keyboard('{ArrowDown}'.repeat(toSaved))

    const id = input().getAttribute('aria-activedescendant')
    expect(document.getElementById(id!)).toHaveTextContent('Steel')
  })
})
