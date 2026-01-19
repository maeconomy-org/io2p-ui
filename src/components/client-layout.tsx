'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import Navbar from '@/components/navbar'
import { useSDKStore, useAuthStore } from '@/stores'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Initialize SDK and auth on app start
  const initializeClient = useSDKStore((state) => state.initializeClient)
  const loadUserInfo = useAuthStore((state) => state.loadUserInfo)
  const isSDKInitialized = useSDKStore((state) => state.isInitialized)

  // Initialize SDK client on mount
  useEffect(() => {
    if (!isSDKInitialized) {
      initializeClient()
    }
  }, [initializeClient, isSDKInitialized])

  // Load user info when SDK is ready
  useEffect(() => {
    if (isSDKInitialized) {
      loadUserInfo()
    }
  }, [isSDKInitialized, loadUserInfo])

  // Pages that don't require authentication don't show the navbar
  const isPublicPage =
    pathname === '/' ||
    pathname === '/help' ||
    pathname === '/terms' ||
    pathname === '/privacy'

  return (
    <div className="flex-1 flex flex-col">
      {!isPublicPage && <Navbar />}
      {children}
    </div>
  )
}
