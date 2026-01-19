'use client'

import { usePathname } from 'next/navigation'
import Footer from '@/components/footer'

export default function ConditionalFooter() {
  const pathname = usePathname()

  // Pages that don't show the footer (public pages)
  const isPublicPage =
    pathname === '/' ||
    pathname === '/help' ||
    pathname === '/terms' ||
    pathname === '/privacy'

  // Don't render footer on public pages
  if (isPublicPage) {
    return null
  }

  return <Footer />
}
