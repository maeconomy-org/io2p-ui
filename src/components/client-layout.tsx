'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import { useKeyboardShortcuts } from '@/hooks/use-theme-shortcut'
import { PUBLIC_PAGES } from '@/constants'

// client-layout wraps EVERY route, so a static import here put driver.js + its CSS in the shared
// bundle for pages that never run a tour.
const TourRunner = dynamic(() => import('./onboarding/tour-runner'), {
  ssr: false,
})
// Mounted here rather than on /objects: the tour points at the navbar, which is on every page, and
// a first login that lands on a deep link or /import-status used to get no onboarding at all.
const InitialLoginTour = dynamic(
  () => import('./onboarding/initial-login-tour'),
  { ssr: false }
)
// Beacons for people who already have their seen-flag set and would otherwise be
// told nothing about what the refactor moved.
const WhatsNewHints = dynamic(() => import('./onboarding/whats-new-hints'), {
  ssr: false,
})

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
        <TourRunner />
        {!isPublicPage && <InitialLoginTour />}
        {!isPublicPage && <WhatsNewHints />}
        {!isPublicPage && <Navbar />}
        {children}
      </div>
      {!isPublicPage && <Footer />}
    </>
  )
}
