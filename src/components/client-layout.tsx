'use client'

import { usePathname } from 'next/navigation'

import Navbar from '@/components/navbar'
import {
  QueryProvider,
  AuthProvider,
  SearchProvider,
  useIomSdkClient,
} from '@/contexts'
import { UploadProgressIndicator } from '@/components/ui'
import DemoTour from './onboarding/DemoTour'

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const client = useIomSdkClient()

  // Pages that don't require authentication don't show the navbar
  const isPublicPage =
    pathname === '/' ||
    pathname === '/help' ||
    pathname === '/terms' ||
    pathname === '/privacy'

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

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </QueryProvider>
  )
}
