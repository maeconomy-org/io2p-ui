import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import {
  FilterMenu,
  deletedSection,
  scopeSection,
} from '@/components/filters/filter-menu'

const t = (key: string) => key

describe('a filter set by the search', () => {
  it('names the search as the reason and keeps the toggle from changing', async () => {
    const onChange = vi.fn()
    render(
      <FilterMenu sections={[deletedSection(t, false, onChange, 'only')]} />
    )
    await userEvent.click(screen.getByTestId('filter-menu'))

    expect(screen.getByTestId('filter-locked-status')).toHaveTextContent(
      'search.deletedSetBySearchOnly'
    )
    await userEvent.click(screen.getByTestId('filter-option-deleted'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('says deleted items are hidden for deleted:false', () => {
    expect(deletedSection(t, true, vi.fn(), 'exclude').disabledReason).toBe(
      'search.deletedSetBySearchExclude'
    )
  })

  it('stays editable without a deleted: token', async () => {
    const onChange = vi.fn()
    render(<FilterMenu sections={[deletedSection(t, false, onChange)]} />)
    await userEvent.click(screen.getByTestId('filter-menu'))

    expect(screen.queryByTestId('filter-locked-status')).toBeNull()
    await userEvent.click(screen.getByTestId('filter-option-deleted'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('leaves a locked section alone when the user clears all filters', async () => {
    const onDeleted = vi.fn()
    const onScope = vi.fn()
    render(
      <FilterMenu
        sections={[
          scopeSection(t, 'mine', onScope, 'all'),
          deletedSection(t, true, onDeleted, 'exclude'),
        ]}
      />
    )
    await userEvent.click(screen.getByTestId('filter-menu'))
    await userEvent.click(screen.getByTestId('filter-clear'))

    expect(onScope).toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
