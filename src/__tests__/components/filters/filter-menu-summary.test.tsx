import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { FilterMenu, scopeSection } from '@/components/filters/filter-menu'

const t = (key: string) => key

describe('the filter trigger', () => {
  it('names the access scope even when nothing is selected', () => {
    // The whole point: a user who never opens this menu still learns they are seeing everyone's
    // items, which the count badge cannot tell them.
    render(<FilterMenu sections={[scopeSection(t, 'all', vi.fn())]} />)

    expect(screen.getByTestId('filter-summary')).toHaveTextContent(
      'common.scopeAll'
    )
    expect(screen.queryByTestId('filter-count')).toBeNull()
  })

  it('badges a scope the user wandered to, not merely one that is set', () => {
    render(<FilterMenu sections={[scopeSection(t, 'mine', vi.fn(), 'all')]} />)

    expect(screen.getByTestId('filter-summary')).toHaveTextContent(
      'common.scopeMine'
    )
    expect(screen.getByTestId('filter-menu').textContent).toContain('1')
  })

  it("leaves the badge clear on the account's own default", () => {
    // The scope is always set to something, so counting membership would mark every list filtered.
    render(<FilterMenu sections={[scopeSection(t, 'mine', vi.fn(), 'mine')]} />)

    expect(screen.getByTestId('filter-summary')).toHaveTextContent(
      'common.scopeMine'
    )
    expect(screen.getByTestId('filter-menu').textContent).not.toContain('1')
  })

  it('says nothing for a section that declares no summary', () => {
    render(
      <FilterMenu
        sections={[
          {
            key: 'deleted',
            label: 'Deleted',
            options: [{ value: 'deleted', label: 'Deleted' }],
            selected: [],
            onChange: vi.fn(),
          },
        ]}
      />
    )

    expect(screen.queryByTestId('filter-summary')).toBeNull()
  })
})
