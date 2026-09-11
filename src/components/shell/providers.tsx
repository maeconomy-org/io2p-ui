'use client'

import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextIntlClientProvider } from 'next-intl'

import { DEFAULT_TIME_ZONE } from '@/i18n/routing'

import {
  PREFERENCES,
  THEME_STORAGE_KEY,
  type ClientConfig,
  type PreferenceHints,
} from '@/constants'
import { Toaster } from '@/components/ui/sonner'
import {
  QueryProvider,
  AuthEffects,
  PreferenceHintsProvider,
  SearchProvider,
} from '@/contexts'
import { UploadCenter } from '@/components/upload-center'
import { UploadQueueProvider } from '@/contexts/upload-queue-context'
import { ImportWatchProvider } from '@/contexts/import-watch-context'
import { ImportWatchers } from '@/components/shell/import-watchers'
import { PreferenceSync } from '@/components/shell/preference-sync'

interface ProvidersProps {
  children: ReactNode
  messages: Record<string, unknown>
  locale: string
  config: ClientConfig
  preferenceHints: PreferenceHints
}

/**
 * All client-side providers consolidated into a single wrapper.
 * Order matters — each provider depends on the one above it:
 *
 * ThemeProvider (next-themes)
 *   NextIntlClientProvider (i18n messages from server)
 *     PreferenceHintsProvider (first-paint preference mirror)
 *       QueryProvider (config + React Query)
 *         AuthEffects (better-auth side effects: cache-wipe, route-guard)
 *         PreferenceSync (the one cookie writer)
 *         SearchProvider
 *           children
 *
 * Auth state itself has no provider — better-auth's useSession is global.
 */
export function Providers({
  children,
  messages,
  locale,
  config,
  preferenceHints,
}: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      // Pinned rather than left implicit, so logout clears a key we declare.
      storageKey={THEME_STORAGE_KEY}
      // next-themes bakes this into its blocking script and reads
      // `localStorage[storageKey] || defaultTheme`, so the cookie value applies
      // BEFORE first paint on a browser whose localStorage was evicted.
      defaultTheme={preferenceHints.theme ?? PREFERENCES.theme.default}
      enableSystem
      disableTransitionOnChange
    >
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone={DEFAULT_TIME_ZONE}
      >
        <PreferenceHintsProvider hints={preferenceHints}>
          <QueryProvider config={config}>
            <InnerProviders>{children}</InnerProviders>
          </QueryProvider>
          <Toaster />
        </PreferenceHintsProvider>
      </NextIntlClientProvider>
    </NextThemesProvider>
  )
}

/**
 * Inner providers that depend on QueryProvider being available (React Query
 * client + config). AuthEffects mounts the one-time auth side effects.
 */
function InnerProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthEffects />
      <PreferenceSync />
      <UploadQueueProvider>
        {/* Above the router: a running import must stay watched after the user leaves `/import`. */}
        <ImportWatchProvider>
          <SearchProvider>{children}</SearchProvider>
          <ImportWatchers />
        </ImportWatchProvider>
        <UploadCenter />
      </UploadQueueProvider>
    </>
  )
}
