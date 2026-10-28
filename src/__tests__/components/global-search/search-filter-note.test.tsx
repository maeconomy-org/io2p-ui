import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${values.filters}` : key,
}))

import { SearchFilterNote } from '@/components/global-search/search-filter-note'
import {
  parseSearchQuery,
  toListParams,
} from '@/components/global-search/search-parser'

const on = (query: string, type: 'objects' | 'formulas') =>
  toListParams(parseSearchQuery(query), type)

describe('SearchFilterNote', () => {
  it('names the filters a list cannot apply, as the user typed them', () => {
    render(
      <SearchFilterNote search={on('prop:material=steel beton', 'formulas')} />
    )

    expect(screen.getByTestId('search-filter-note')).toHaveTextContent(
      'search.notApplied prop:material=steel'
    )
  })

  it('names an invalid filter separately', () => {
    render(<SearchFilterNote search={on('prop:a:b=c createdBy:', 'objects')} />)

    expect(screen.getByTestId('search-filter-note')).toHaveTextContent(
      'search.invalidFilter prop:a:b=c, createdBy:'
    )
    expect(screen.queryByText(/search\.notApplied/)).toBeNull()
  })

  it.each([
    ['no active search', null],
    ['every filter applied', on('prop:material=steel beton', 'objects')],
  ])('shows nothing with %s', (_case, search) => {
    render(<SearchFilterNote search={search} />)
    expect(screen.queryByTestId('search-filter-note')).toBeNull()
  })
})
