import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import messages from '@/messages/en.json'

import {
  HereAddressAutocomplete,
  type AddressComponents,
} from '@/components/ui/here-address-autocomplete'

const authFetch = vi.fn()
const loggerWarn = vi.fn()

vi.mock('@/lib/auth/fetch', () => ({
  authFetch: (url: string) => authFetch(url),
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: (...args: unknown[]) => loggerWarn(...args),
  },
}))

const SUGGESTION = {
  id: 'here:af:street:abc123',
  title: 'Stadhuisplein 1, Amersfoort',
  address: {
    label: 'Stadhuisplein 1, 3811 LM Amersfoort, Nederland',
    street: 'Stadhuisplein',
    houseNumber: '1',
    postalCode: '3811 LM',
    city: 'Amersfoort',
    countryCode: 'NLD',
    countryName: 'Nederland',
    state: 'Utrecht',
  },
}

const json = (body: unknown) => Promise.resolve({ json: async () => body })

/** Autocomplete answers with the suggestion; the lookup answers per test. */
function respond(lookup: () => Promise<unknown>) {
  authFetch.mockImplementation((url: string) =>
    url.includes('id=') ? lookup() : json({ items: [SUGGESTION] })
  )
}

type OnSelect = (full: string, components: AddressComponents) => void

async function pick(onAddressSelect: Mock<OnSelect>) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HereAddressAutocomplete onAddressSelect={onAddressSelect} value="" />
    </NextIntlClientProvider>
  )
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'stadhuisplein' },
  })
  fireEvent.click(await screen.findByText(SUGGESTION.title))
}

describe('HereAddressAutocomplete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves the picked suggestion by id and reports its coordinates', async () => {
    respond(() => json({ position: { lat: 52.15672, lng: 5.38416 } }))
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    // Two calls: the address lands immediately, coordinates follow.
    await waitFor(() => expect(onAddressSelect).toHaveBeenCalledTimes(2))
    const [, components] = onAddressSelect.mock.calls[1]
    expect(components.lat).toBe(52.15672)
    expect(components.lng).toBe(5.38416)
    expect(components.city).toBe('Amersfoort')
  })

  it('applies the address BEFORE the lookup resolves', async () => {
    // The regression this guards: awaiting the lookup first leaves a window where the input shows
    // the address but the form does not hold it — saving there loses the address entirely.
    let release: (v: unknown) => void = () => {}
    respond(() => new Promise((r) => (release = r)))
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    await waitFor(() => expect(onAddressSelect).toHaveBeenCalledTimes(1))
    const [full, components] = onAddressSelect.mock.calls[0]
    expect(full).toBe(SUGGESTION.address.label)
    expect(components.lat).toBeUndefined()

    release({ json: async () => ({ position: { lat: 1, lng: 2 } }) })
  })

  it('stores the country as a stable code, not a localised name', async () => {
    // "Nederland" is whatever language HERE answered in, so grouping by country was a string match
    // against a value that moved. The code does not.
    respond(() => json({ position: { lat: 1, lng: 2 } }))
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    expect(onAddressSelect.mock.calls[0][1].country).toBe('NL')
  })

  it('falls back to the country name when the code cannot be mapped', async () => {
    // Something in the field beats nothing, and the read side renders a non-code unchanged.
    respond(() => json({ position: { lat: 1, lng: 2 } }))
    authFetch.mockImplementation((url: string) =>
      url.includes('id=')
        ? json({ position: { lat: 1, lng: 2 } })
        : json({
            items: [
              {
                ...SUGGESTION,
                address: { ...SUGGESTION.address, countryCode: 'XYZ' },
              },
            ],
          })
    )
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    expect(onAddressSelect.mock.calls[0][1].country).toBe('Nederland')
    expect(loggerWarn).toHaveBeenCalled()
  })

  it('does not search again for the address it just resolved', async () => {
    // Regression: the debounced search watched `query`, which a selection also sets — so picking an
    // address fired a THIRD request asking HERE to autocomplete the address it had just resolved.
    respond(() => json({ position: { lat: 1, lng: 2 } }))

    await pick(vi.fn<OnSelect>())
    await waitFor(() =>
      expect(authFetch.mock.calls.some(([url]) => url.includes('id='))).toBe(
        true
      )
    )
    // Long enough for the 300ms debounce to have fired if it were going to.
    await new Promise((r) => setTimeout(r, 400))

    const searches = authFetch.mock.calls.filter(([url]) => url.includes('q='))
    expect(searches).toHaveLength(1)
    expect(searches[0][0]).toContain('stadhuisplein')
  })

  it('looks the id up, never the free text', async () => {
    respond(() => json({ position: { lat: 1, lng: 2 } }))

    await pick(vi.fn<OnSelect>())

    await waitFor(() =>
      expect(authFetch.mock.calls.some(([url]) => url.includes('id='))).toBe(
        true
      )
    )
    const lookupUrl = authFetch.mock.calls.find(([url]) =>
      url.includes('id=')
    )![0]
    expect(lookupUrl).toContain(encodeURIComponent(SUGGESTION.id))
  })

  it('keeps the address and warns when the lookup fails', async () => {
    respond(() => Promise.reject(new Error('offline')))
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    await waitFor(() => expect(loggerWarn).toHaveBeenCalledTimes(1))
    // Still applied — a geocoding outage must never block address entry.
    expect(onAddressSelect).toHaveBeenCalledTimes(1)
    expect(onAddressSelect.mock.calls[0][1].fullAddress).toBe(
      SUGGESTION.address.label
    )
  })

  it('warns rather than storing half a coordinate when position is absent', async () => {
    respond(() => json({ title: 'somewhere', address: {} }))
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    await waitFor(() => expect(loggerWarn).toHaveBeenCalledTimes(1))
    expect(onAddressSelect).toHaveBeenCalledTimes(1)
  })

  it('ignores a lookup that returns a non-numeric position', async () => {
    respond(() => json({ position: { lat: '52.1', lng: null } }))
    const onAddressSelect = vi.fn<OnSelect>()

    await pick(onAddressSelect)

    await waitFor(() => expect(loggerWarn).toHaveBeenCalledTimes(1))
    expect(onAddressSelect).toHaveBeenCalledTimes(1)
  })
})
