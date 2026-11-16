import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { ListErrorAlert, PickerListError } from '@/components/list-error'
import { EntityTable, nameColumn } from '@/components/entity-list'
import { listErrorMessage } from '@/lib/list-error'
import en from '@/messages/en.json'
import nl from '@/messages/nl.json'

const SLOW =
  'the list took too long — refine your search (add a filter or a longer q)'
const refused = { status: 422, detail: SLOW }

describe('listErrorMessage', () => {
  it.each([
    ['a 422 with a detail', refused],
    ['a 400 with a detail', { status: 400, detail: 'size must be <= 100' }],
  ])('passes on the node detail for %s', (_, error) => {
    expect(listErrorMessage(error)).toEqual({
      key: 'common.listRefused',
      detail: error.detail,
    })
  })

  it.each([
    ['a 422 with no detail', { status: 422 }],
    ['a 503', { status: 503, detail: 'unavailable' }],
    ['no answer, even with a detail', { status: 0, detail: 'fetch failed' }],
    ['a plain error', new Error('boom')],
  ])('asks for a retry for %s', (_, error) => {
    expect(listErrorMessage(error)).toEqual({ key: 'common.listFailed' })
  })
})

const inLocale = (locale: 'en' | 'nl', ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : nl}
    >
      {ui}
    </NextIntlClientProvider>
  )

describe('ListErrorAlert', () => {
  it('says why the node refused the list, with its English marked as English', () => {
    inLocale('nl', <ListErrorAlert error={refused} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(`Deze lijst kon niet laden: ${SLOW}`)
    expect(screen.getByText(SLOW)).toHaveAttribute('lang', 'en')
  })

  it('offers a retry for a list that did not answer', () => {
    const onRetry = vi.fn()
    inLocale('en', <ListErrorAlert error={{ status: 503 }} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The list could not load. Try again.'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('PickerListError', () => {
  it('is an empty status region while there is no error', () => {
    inLocale('en', <PickerListError error={null} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says why the list could not load', () => {
    inLocale('en', <PickerListError error={refused} />)
    expect(screen.getByRole('status')).toHaveTextContent(SLOW)
  })
})

describe('EntityTable with a failed list', () => {
  const columns = [nameColumn<{ id: string; name: string }>((row) => row.name)]

  it('shows why, not the empty state', () => {
    inLocale(
      'en',
      <EntityTable
        columns={columns}
        page={undefined}
        getRowId={(row) => row.id}
        error={refused}
        emptyTitle="No objects yet"
      />
    )
    expect(screen.getByTestId('list-error')).toHaveTextContent(SLOW)
    expect(screen.queryByText('No objects yet')).toBeNull()
  })

  it('shows the empty state when the list answered with no rows', () => {
    inLocale(
      'en',
      <EntityTable
        columns={columns}
        page={{
          data: [],
          page: { number: 1, size: 20, totalElements: 0, totalPages: 0 },
        }}
        getRowId={(row) => row.id}
        error={null}
        emptyTitle="No objects yet"
      />
    )
    expect(screen.getByText('No objects yet')).toBeInTheDocument()
    expect(screen.queryByTestId('list-error')).toBeNull()
  })
})
