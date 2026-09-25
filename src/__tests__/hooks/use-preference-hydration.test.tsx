import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { usePreference } from '@/hooks/ui/use-preference'
import { PreferenceHintsProvider } from '@/contexts/preference-hints-context'
import { queryKeys } from '@/lib/query-keys'
import type { PreferenceHints } from '@/constants'

/**
 * The regression guard for the whole first-paint design.
 *
 * The server cannot read the account, so it renders the cookie HINT. The browser
 * restores auth synchronously, so its very first render can already hold a
 * DIFFERENT `/me` answer. If the hook ever prefers the stored value on that
 * first render, React reports a hydration mismatch on every load — which is
 * exactly the bug that put a skeleton on `/objects`.
 */

const USER = { id: 'user-a', identities: [], preferences: {} as never }

let authState: {
  preferences?: unknown
  authLoading: boolean
  isAuthenticated?: boolean
} = {
  preferences: undefined,
  authLoading: false,
}
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => authState }))
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences: vi.fn() } }),
}))

function Probe() {
  const [view] = usePreference('objectsView')
  return <span>{view}</span>
}

const Tree = ({
  hints,
  client,
}: {
  hints: PreferenceHints
  client: QueryClient
}) => (
  <QueryClientProvider client={client}>
    <PreferenceHintsProvider hints={hints}>
      <Probe />
    </PreferenceHintsProvider>
  </QueryClientProvider>
)

let consoleError: ReturnType<typeof vi.spyOn>

// React reports a mismatch through `console.error` ASYNCHRONOUSLY, so asserting
// on a captured log races the assertion and passes while the bug is present.
// `onRecoverableError` is the synchronous channel and is what this pins.
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => consoleError.mockRestore())

describe('usePreference hydration parity', () => {
  it('hydrates the hint cleanly even when the cache already disagrees', async () => {
    const hints: PreferenceHints = { objectsView: 'columns' }

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    authState = {
      preferences: undefined,
      authLoading: false,
      isAuthenticated: true,
    }
    const html = renderToString(<Tree hints={hints} client={client} />)
    expect(html).toContain('columns')

    // A WARM cache holding a different answer — the hostile case.
    const warm = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    warm.setQueryData(queryKeys.users.current, {
      ...USER,
      preferences: { ui: { objectsView: 'table' } },
    })
    authState = {
      preferences: { ui: { objectsView: 'table' } },
      authLoading: false,
    }

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const recoverable: string[] = []
    await act(async () => {
      hydrateRoot(container, <Tree hints={hints} client={warm} />, {
        onRecoverableError: (error) => recoverable.push(String(error)),
      })
    })

    expect(recoverable).toEqual([])
    // And the account still wins once hydration is done.
    expect(container.textContent).toBe('table')
  })
})
