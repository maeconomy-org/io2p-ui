import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAddressManagement } from '@/components/object-sheets/hooks/use-address-management'

// ─── Mocks ───────────────────────────────────────────

const createAddress = vi.fn()
const updateAddress = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/api', () => ({
  useAddresses: () => ({
    useCreateAddress: () => ({ mutateAsync: createAddress }),
    useUpdateAddress: () => ({ mutateAsync: updateAddress }),
  }),
}))

vi.mock('@/lib', async () => {
  const actual = await vi.importActual<any>('@/lib')
  return {
    ...actual,
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    isForbiddenError: (err: any) => err?.status === 403,
  }
})

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper }
}

const sampleAddress = {
  uuid: 'addr-1',
  fullAddress: '123 Main St, Springfield',
  street: 'Main St',
  houseNumber: '123',
  city: 'Springfield',
  postalCode: '12345',
  country: 'NL',
  state: '',
  district: '',
}

describe('useAddressManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('seeds addressData and editedAddressData from initialAddressInfo', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () =>
        useAddressManagement({
          initialAddressInfo: sampleAddress,
          objectUuid: 'o1',
        }),
      { wrapper }
    )

    await waitFor(() =>
      expect(result.current.addressData.fullAddress).toBe(
        '123 Main St, Springfield'
      )
    )
    expect(result.current.editedAddressData.fullAddress).toBe(
      '123 Main St, Springfield'
    )
    expect(result.current.hasAddressChanged).toBe(false)
  })

  it('flips hasAddressChanged when any tracked field diverges', async () => {
    const { wrapper } = makeWrapper()
    const { result, rerender } = renderHook(
      () =>
        useAddressManagement({
          initialAddressInfo: sampleAddress,
          objectUuid: 'o1',
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.addressData.uuid).toBe('addr-1'))

    act(() => {
      result.current.setEditedAddressData({
        ...sampleAddress,
        street: 'Different St',
      })
    })
    rerender()
    expect(result.current.hasAddressChanged).toBe(true)
  })

  it('saveAddress short-circuits when nothing changed', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () =>
        useAddressManagement({
          initialAddressInfo: sampleAddress,
          objectUuid: 'o1',
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.addressData.uuid).toBe('addr-1'))

    await act(async () => {
      await result.current.saveAddress()
    })
    expect(updateAddress).not.toHaveBeenCalled()
    expect(createAddress).not.toHaveBeenCalled()
  })

  it('updates an existing address when initialAddressInfo.uuid is present', async () => {
    updateAddress.mockResolvedValue(undefined)
    const { wrapper } = makeWrapper()
    const { result, rerender } = renderHook(
      () =>
        useAddressManagement({
          initialAddressInfo: sampleAddress,
          objectUuid: 'o1',
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.addressData.uuid).toBe('addr-1'))

    act(() => {
      result.current.setEditedAddressData({
        ...sampleAddress,
        city: 'Shelbyville',
      })
    })
    rerender()
    await act(async () => {
      await result.current.saveAddress()
    })

    expect(updateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'addr-1', city: 'Shelbyville' })
    )
    expect(createAddress).not.toHaveBeenCalled()
  })

  it('creates a new address when no existing uuid but objectUuid is provided', async () => {
    createAddress.mockResolvedValue(undefined)
    const { wrapper } = makeWrapper()
    const initialNoUuid = {
      ...sampleAddress,
      uuid: undefined,
    }
    const { result, rerender } = renderHook(
      () =>
        useAddressManagement({
          initialAddressInfo: initialNoUuid,
          objectUuid: 'o1',
        }),
      { wrapper }
    )
    await waitFor(() =>
      expect(result.current.editedAddressData.fullAddress).toBe(
        '123 Main St, Springfield'
      )
    )

    act(() => {
      result.current.setEditedAddressData({
        ...initialNoUuid,
        street: 'Elm St',
      })
    })
    rerender()
    await act(async () => {
      await result.current.saveAddress()
    })

    expect(createAddress).toHaveBeenCalledWith({
      address: expect.objectContaining({ street: 'Elm St' }),
    })
    expect(updateAddress).not.toHaveBeenCalled()
  })

  it('rethrows on mutation failure so EditableSection can surface the error', async () => {
    updateAddress.mockRejectedValue(new Error('api down'))
    const { wrapper } = makeWrapper()
    const { result, rerender } = renderHook(
      () =>
        useAddressManagement({
          initialAddressInfo: sampleAddress,
          objectUuid: 'o1',
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.addressData.uuid).toBe('addr-1'))

    act(() => {
      result.current.setEditedAddressData({
        ...sampleAddress,
        country: 'BE',
      })
    })
    rerender()
    await act(async () => {
      await expect(result.current.saveAddress()).rejects.toThrow('api down')
    })
  })
})
