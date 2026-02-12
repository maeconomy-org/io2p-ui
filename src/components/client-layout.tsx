'use client'

import { usePathname } from 'next/navigation'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import { useKeyboardShortcuts } from '@/hooks'
import { UploadProgressIndicator } from '@/components/ui'
import { PUBLIC_PAGES } from '@/constants'
import DemoTour from './onboarding/demo-tour'

/**
 * Layout shell — navbar, footer, keyboard shortcuts, and page chrome.
 * All providers are handled by Providers in providers.tsx.
 */
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isPublicPage = PUBLIC_PAGES.includes(pathname)

  useKeyboardShortcuts()

  return (
    <>
      <div className="flex-1 flex flex-col">
        <DemoTour />
        {!isPublicPage && <Navbar />}
        {children}
        <UploadProgressIndicator />
      </div>
      {!isPublicPage && <Footer />}
    </>
  )
}
