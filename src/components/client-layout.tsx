'use client'

import { usePathname } from 'next/navigation'

import Navbar from '@/components/navbar'
import {
  QueryProvider,
  AuthProvider,
  SearchProvider,
  useIomSdkClient,
} from '@/contexts'
import { useKeyboardShortcuts } from '@/hooks'
import { UploadProgressIndicator } from '@/components/ui'
import DemoTour from './onboarding/DemoTour'

const PUBLIC_PAGES = ['/', '/help', '/terms', '/privacy']

/**
 * Inner layout that depends on QueryProvider being available
 * (useIomSdkClient requires QueryProvider context)
 */
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const client = useIomSdkClient()
  const isPublicPage = PUBLIC_PAGES.includes(pathname)

  useKeyboardShortcuts()

  return (
    <AuthProvider client={client}>
      <SearchProvider>
        <div className="flex-1 flex flex-col">
          <DemoTour />
          {!isPublicPage && <Navbar />}
          {children}
          <UploadProgressIndicator />
        </div>
      </SearchProvider>
    </AuthProvider>
  )
}

/**
 * Client-side providers and layout shell.
 * QueryProvider must wrap AuthenticatedLayout because useIomSdkClient depends on it.
 */
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </QueryProvider>
  )
}
