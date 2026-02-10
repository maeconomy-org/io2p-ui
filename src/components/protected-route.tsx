'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts'
import { ContentSkeleton } from '@/components/skeletons'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, authLoading } = useAuth()

  useEffect(() => {
    // Only redirect after auth check is complete
    if (!authLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [router, isAuthenticated, authLoading])

  // Show skeleton while auth is being checked - prevents flicker
  if (authLoading || !isAuthenticated) {
    return <ContentSkeleton />
  }

  return <>{children}</>
}
