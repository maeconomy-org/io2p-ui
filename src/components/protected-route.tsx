'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, checkAuth } = useAuth()

  useEffect(() => {
    const authenticated = checkAuth()
    if (!authenticated) {
      router.push('/')
    }
  }, [router, checkAuth])

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    )
  }

  return <>{children}</>
}
