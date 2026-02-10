'use client'

import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextIntlClientProvider } from 'next-intl'

import { Toaster } from '@/components/ui/sonner'
import {
  QueryProvider,
  AuthProvider,
  SearchProvider,
  useIomSdkClient,
} from '@/contexts'

interface ProvidersProps {
  children: ReactNode
  messages: Record<string, unknown>
  locale: string
}

/**
 * All client-side providers consolidated into a single wrapper.
 * Order matters — each provider depends on the one above it:
 *
 * ThemeProvider (next-themes)
 *   NextIntlClientProvider (i18n messages from server)
 *     QueryProvider (SDK client + config + React Query)
 *       AuthProvider (auth state, depends on SDK client)
 *         SearchProvider (search state, depends on SDK client)
 *           children
 */
export function Providers({ children, messages, locale }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        <QueryProvider>
          <InnerProviders>{children}</InnerProviders>
        </QueryProvider>
        <Toaster />
      </NextIntlClientProvider>
    </NextThemesProvider>
  )
}

/**
 * Inner providers that depend on QueryProvider being available.
 * Separated because useIomSdkClient requires QueryProvider context.
 */
function InnerProviders({ children }: { children: ReactNode }) {
  const client = useIomSdkClient()

  return (
    <AuthProvider client={client}>
      <SearchProvider>{children}</SearchProvider>
    </AuthProvider>
  )
}
