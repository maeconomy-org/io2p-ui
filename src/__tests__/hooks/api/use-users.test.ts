import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useUsers } from '@/hooks/api/use-users'

const getCurrentUser = vi.fn()
const findByIdentifier = vi.fn()

vi.mock('@/contexts', () => ({
  useIomSdkClient: () => ({
    user: {
      getCurrentUser,
      findByIdentifier,
    },
  }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useCurrentUser', () => {
    it('fetches the authenticated user', async () => {
      const user = {
        userUUID: 'u-1',
        identifier: 'u-1@example.com',
        identifierType: 'UserAuthUP',
        createdAt: '2026-01-01T00:00:00.000Z',
      }
      getCurrentUser.mockResolvedValue(user)

      const { result } = renderHook(() => useUsers().useCurrentUser(), {
        wrapper: makeWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(user)
      expect(getCurrentUser).toHaveBeenCalledOnce()
    })
  })

  describe('useFindUserByIdentifier', () => {
    it('returns matches for a non-empty identifier', async () => {
      const matches = [
        {
          userUUID: 'u-1',
          identifier: 'test@example.com',
          identifierType: 'UserAuthUP',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]
      findByIdentifier.mockResolvedValue(matches)

      const { result } = renderHook(
        () => useUsers().useFindUserByIdentifier('test@example.com'),
        { wrapper: makeWrapper() }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(matches)
      expect(findByIdentifier).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object)
      )
    })

    it('returns an empty array when no users match', async () => {
      findByIdentifier.mockResolvedValue([])

      const { result } = renderHook(
        () => useUsers().useFindUserByIdentifier('nobody@example.com'),
        { wrapper: makeWrapper() }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('is disabled when the identifier is empty', async () => {
      const { result } = renderHook(
        () => useUsers().useFindUserByIdentifier(''),
        { wrapper: makeWrapper() }
      )

      // Give React Query a tick to run any enabled query
      await new Promise((r) => setTimeout(r, 10))
      expect(findByIdentifier).not.toHaveBeenCalled()
      expect(result.current.fetchStatus).toBe('idle')
    })

    it('is disabled when explicit enabled=false', async () => {
      const { result } = renderHook(
        () =>
          useUsers().useFindUserByIdentifier('test@example.com', {
            enabled: false,
          }),
        { wrapper: makeWrapper() }
      )

      await new Promise((r) => setTimeout(r, 10))
      expect(findByIdentifier).not.toHaveBeenCalled()
      expect(result.current.fetchStatus).toBe('idle')
    })

    it('propagates errors', async () => {
      findByIdentifier.mockRejectedValue(new Error('boom'))

      const { result } = renderHook(
        () => useUsers().useFindUserByIdentifier('test@example.com'),
        { wrapper: makeWrapper() }
      )

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect((result.current.error as Error).message).toBe('boom')
    })
  })
})
