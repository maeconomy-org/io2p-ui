'use client'

import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextIntlClientProvider } from 'next-intl'

import { DEFAULT_TIME_ZONE } from '@/i18n/routing'

import type { ClientConfig } from '@/constants'
import { Toaster } from '@/components/ui/sonner'
import { QueryProvider, AuthEffects, SearchProvider } from '@/contexts'
import { UploadCenter } from '@/components/upload-center'
import { UploadQueueProvider } from '@/contexts/upload-queue-context'

interface ProvidersProps {
  children: ReactNode
  messages: Record<string, unknown>
  locale: string
  config: ClientConfig
}

/**
 * All client-side providers consolidated into a single wrapper.
 * Order matters — each provider depends on the one above it:
 *
 * ThemeProvider (next-themes)
 *   NextIntlClientProvider (i18n messages from server)
 *     QueryProvider (config + React Query)
 *       AuthEffects (better-auth side effects: cache-wipe, route-guard)
 *       SearchProvider
 *         children
 *
 * Auth state itself has no provider — better-auth's useSession is global.
 */
export function Providers({
  children,
  messages,
  locale,
  config,
}: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone={DEFAULT_TIME_ZONE}
      >
        <QueryProvider config={config}>
          <InnerProviders>{children}</InnerProviders>
        </QueryProvider>
        <Toaster />
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
      <UploadQueueProvider>
        <SearchProvider>{children}</SearchProvider>
        <UploadCenter />
      </UploadQueueProvider>
    </>
  )
}
