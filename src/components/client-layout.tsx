'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import { useKeyboardShortcuts } from '@/hooks'
import { PUBLIC_PAGES } from '@/constants'

// client-layout wraps EVERY route, so a static import here put driver.js + its CSS in the shared
// bundle for pages that never run a tour.
const DemoTour = dynamic(() => import('./onboarding/demo-tour'), { ssr: false })

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
      </div>
      {!isPublicPage && <Footer />}
    </>
  )
}
