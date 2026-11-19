import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  onlineManager,
  QueryClient,
  QueryObserver,
} from '@tanstack/react-query'

import {
  QUERY_DEFAULTS,
  refetchFailedOnReconnect,
} from '@/contexts/query-context'

describe('a list query while the browser is offline', () => {
  afterEach(() => onlineManager.setOnline(true))

  it('fails like any network failure, so the list shows why, not "Loading" without end', async () => {
    onlineManager.setOnline(false)
    const client = new QueryClient({
      defaultOptions: { queries: { ...QUERY_DEFAULTS, retry: false } },
    })

    await expect(
      client.fetchQuery({
        queryKey: ['offline-list'],
        queryFn: () => Promise.reject(new TypeError('Failed to fetch')),
      })
    ).rejects.toThrow('Failed to fetch')
    expect(client.getQueryState(['offline-list'])).toMatchObject({
      status: 'error',
      fetchStatus: 'idle',
    })
  })
})

describe('a list that failed while offline', () => {
  afterEach(() => onlineManager.setOnline(true))

  const watch = (client: QueryClient, queryFn: () => Promise<string>) => {
    const observer = new QueryObserver(client, {
      queryKey: ['list'],
      queryFn,
      ...QUERY_DEFAULTS,
      retry: false,
    })
    const stop = observer.subscribe(() => {})
    return { observer, stop }
  }

  it.each([
    ['a fetch that failed', new TypeError('Failed to fetch')],
    ['the SDK network error (status 0)', { status: 0, detail: 'fetch failed' }],
  ])(
    'loads again when the browser is back online, after %s',
    async (_, failure) => {
      const client = new QueryClient()
      const stopReconnect = refetchFailedOnReconnect(client)
      let online = false
      const { observer, stop } = watch(client, () =>
        online ? Promise.resolve('rows') : Promise.reject(failure)
      )
      onlineManager.setOnline(false)
      await vi.waitFor(() =>
        expect(observer.getCurrentResult().status).toBe('error')
      )

      online = true
      onlineManager.setOnline(true)
      await vi.waitFor(() =>
        expect(observer.getCurrentResult().data).toBe('rows')
      )
      stop()
      stopReconnect()
    }
  )

  it('does not ask again for a list the node refused: it would refuse again', async () => {
    const client = new QueryClient()
    const stopReconnect = refetchFailedOnReconnect(client)
    const queryFn = vi.fn(() => Promise.reject({ status: 422, detail: 'no' }))
    const { observer, stop } = watch(client, queryFn)
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().status).toBe('error')
    )
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await new Promise((r) => setTimeout(r, 20))
    expect(queryFn).toHaveBeenCalledTimes(1)
    stop()
    stopReconnect()
  })
})
