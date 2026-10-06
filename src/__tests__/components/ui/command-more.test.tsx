import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CommandMore } from '@/components/ui/command-more'

vi.mock('next-intl', () => ({
  useTranslations:
    () => (key: string, values?: { shown: number; total: number }) =>
      `${key} ${values?.shown}/${values?.total}`,
}))

const page = (rows: number, totalElements: number) => ({
  data: Array.from({ length: rows }, (_, i) => i),
  page: { totalElements },
})

describe('CommandMore', () => {
  it('stays hidden when the page holds everything', () => {
    render(<CommandMore pages={[page(7, 7)]} />)

    expect(screen.queryByTestId('command-more')).toBeNull()
  })

  it('says how many of how many when the page is cut', () => {
    render(<CommandMore pages={[page(20, 143)]} />)

    expect(screen.getByTestId('command-more')).toHaveTextContent(
      'common.pickerMore 20/143'
    )
  })

  it('adds up the pages of a list that merges several types', () => {
    render(<CommandMore pages={[page(8, 8), page(8, 30), page(3, 3)]} />)

    expect(screen.getByTestId('command-more')).toHaveTextContent(
      'common.pickerMore 19/41'
    )
  })

  it('skips a type that has not loaded yet', () => {
    render(<CommandMore pages={[undefined, page(8, 12)]} />)

    expect(screen.getByTestId('command-more')).toHaveTextContent(
      'common.pickerMore 8/12'
    )
  })
})
