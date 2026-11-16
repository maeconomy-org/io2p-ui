import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { flexRender, type CellContext } from '@tanstack/react-table'
import type { ObjectListItem } from 'io2p-client'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { buildObjectColumns } from '@/app/objects/components/object-columns'

const actions = {
  onViewDetails: vi.fn(),
  onShowQRCode: vi.fn(),
  onDuplicate: vi.fn(),
  onCreateTemplate: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
}

function cell(
  columnId: 'childCount' | 'name',
  row: Partial<ObjectListItem>,
  locale: 'en' | 'nl' = 'en',
  onRowClick?: () => void
) {
  const messages = locale === 'en' ? en : nl
  const t = createTranslator({ locale, messages }) as unknown as (
    key: string,
    values?: Record<string, string | number | Date>
  ) => string
  const column = buildObjectColumns({ t, actions }).find(
    (c) => c.id === columnId
  )!
  const context = {
    row: { original: { id: 'o-1', name: 'Blok A', ...row } },
  } as unknown as CellContext<ObjectListItem, unknown>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Europe/Amsterdam"
    >
      <div data-testid="cell" onClick={onRowClick}>
        {flexRender(column.cell, context)}
      </div>
    </NextIntlClientProvider>
  )
  return screen.getByTestId('cell')
}

describe('the objects table child count', () => {
  it('shows a capped count as 1,000+', () => {
    expect(cell('childCount', { childCount: 1001 })).toHaveTextContent(
      /^1,000\+$/
    )
  })

  it('shows a capped count in Dutch format', () => {
    expect(cell('childCount', { childCount: 1001 }, 'nl')).toHaveTextContent(
      /^1\.000\+$/
    )
  })

  it('shows a leaf as 0 and a count up to 1,000 as the number', () => {
    expect(cell('childCount', { childCount: 0 })).toHaveTextContent(/^0$/)
  })

  it('shows a count the node did not read as a dash a screen reader can explain', () => {
    const c = cell('childCount', {})
    expect(c).toHaveTextContent('Count not available')
    expect(c.textContent).not.toContain('0')
  })

  it('opens the reason by keyboard, and the click does not reach the row', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    cell('childCount', {}, 'en', onRowClick)
    await user.tab()
    expect(screen.getByTestId('count-unavailable')).toHaveFocus()
    await user.click(screen.getByTestId('count-unavailable'))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('puts 1,000+ on the name badge of a capped row', () => {
    expect(cell('name', { childCount: 1001 })).toHaveTextContent('Blok A1,000+')
  })
})
