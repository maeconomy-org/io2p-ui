import { describe, expect, it, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '', number: String }),
}))

import {
  MarkedName,
  SearchHighlight,
  SearchMarkProvider,
  useShownSearch,
} from '@/components/search-highlight'
import { EntityTable, nameColumn } from '@/components/entity-list'

const marks = (container: HTMLElement) =>
  [...container.querySelectorAll('mark')].map((mark) => mark.textContent)

describe('SearchHighlight', () => {
  it('marks each search word and keeps the name whole', () => {
    const { container } = render(
      <SearchHighlight text="Vloer van beton" q="beton vloer" />
    )
    expect(marks(container)).toEqual(['Vloer', 'beton'])
    expect(container.textContent).toBe('Vloer van beton')
  })

  it('marks a name with an accent the search did not type', () => {
    const { container } = render(
      <SearchHighlight text="Ideeën plein" q="ideeen" />
    )
    expect(marks(container)).toEqual(['Ideeën'])
  })

  it('renders the plain name with no search', () => {
    const { container } = render(<SearchHighlight text="Beton" q={undefined} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('Beton')
  })

  it('marks the names inside a search mark provider only', () => {
    const inside = render(
      <SearchMarkProvider value="beton">
        <MarkedName text="Beton vloer" />
      </SearchMarkProvider>
    )
    expect(marks(inside.container)).toEqual(['Beton'])
    const outside = render(<MarkedName text="Beton vloer" />)
    expect(outside.container.querySelector('mark')).toBeNull()
  })
})

describe('useShownSearch', () => {
  it('keeps the search of the rows on screen while new rows load', () => {
    const { result, rerender } = renderHook(
      ({ q, old }) => useShownSearch(q, old),
      { initialProps: { q: 'beton' as string | undefined, old: false } }
    )
    rerender({ q: 'vloer', old: true })
    expect(result.current).toBe('beton')
    rerender({ q: 'vloer', old: false })
    expect(result.current).toBe('vloer')
  })
})

describe('EntityTable name column', () => {
  const page = {
    data: [{ id: 'o-1', name: 'Beton vloer' }],
    page: { number: 1, size: 20, totalElements: 1, totalPages: 1 },
  }
  const columns = [nameColumn<{ id: string; name: string }>((row) => row.name)]

  it('marks the search words of the table it is in', () => {
    const { container } = render(
      <EntityTable
        columns={columns}
        page={page}
        getRowId={(row) => row.id}
        error={null}
        highlight="vloer"
      />
    )
    expect(marks(container)).toEqual(['vloer'])
  })

  it('marks nothing in a table with no search', () => {
    const { container } = render(
      <EntityTable
        columns={columns}
        page={page}
        getRowId={(row) => row.id}
        error={null}
      />
    )
    expect(container.querySelector('mark')).toBeNull()
  })
})
