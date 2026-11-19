import { afterEach, describe, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
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

describe('listErrorMessage while offline', () => {
  it('says there is no connection for a list that got no answer', () => {
    expect(listErrorMessage(new TypeError('Failed to fetch'), false)).toEqual({
      key: 'common.listOffline',
    })
  })

  it('keeps the general text while online', () => {
    expect(listErrorMessage(new TypeError('Failed to fetch'), true)).toEqual({
      key: 'common.listFailed',
    })
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
      'The list could not load.'
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('load. Try again')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry for a list the node refused', () => {
    inLocale('en', <ListErrorAlert error={refused} onRetry={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('shows a retry that is running as busy', () => {
    inLocale(
      'en',
      <ListErrorAlert error={{ status: 503 }} onRetry={vi.fn()} retrying />
    )
    const button = screen.getByRole('button', { name: 'Try again' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
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

  it('asks for a retry in words, as it has no button', () => {
    inLocale('en', <PickerListError error={{ status: 503 }} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'The list could not load. Try again.'
    )
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

  it('shows a retry as busy while the table fetches again', () => {
    inLocale(
      'en',
      <EntityTable
        columns={columns}
        page={undefined}
        getRowId={(row) => row.id}
        error={{ status: 503 }}
        onRetry={vi.fn()}
        fetching
      />
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
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

describe('ListErrorAlert while offline', () => {
  afterEach(() => onlineManager.setOnline(true))

  it('says there is no connection, and still offers a retry', () => {
    onlineManager.setOnline(false)
    const onRetry = vi.fn()
    inLocale(
      'en',
      <ListErrorAlert
        error={new TypeError('Failed to fetch')}
        onRetry={onRetry}
      />
    )
    expect(screen.getByTestId('list-error')).toHaveTextContent(
      en.common.listOffline
    )
    fireEvent.click(screen.getByRole('button', { name: en.common.listRetry }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
