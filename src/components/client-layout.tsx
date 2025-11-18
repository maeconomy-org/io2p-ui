'use client'

import { usePathname } from 'next/navigation'

import Navbar from '@/components/navbar'
import { AuthProvider } from '@/contexts'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // Pages that don't require authentication don't show the navbar
  const isPublicPage =
    pathname === '/' ||
    pathname === '/help' ||
    pathname === '/terms' ||
    pathname === '/privacy'

  return (
    <AuthProvider>
      <div className="flex-1 flex flex-col">
        {!isPublicPage && <Navbar />}
        {children}
      </div>
    </AuthProvider>
  )
}
