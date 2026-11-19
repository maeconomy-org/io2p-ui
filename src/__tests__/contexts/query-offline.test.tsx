import { afterEach, describe, expect, it } from 'vitest'
import { onlineManager, QueryClient } from '@tanstack/react-query'

import { QUERY_DEFAULTS } from '@/contexts/query-context'

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
