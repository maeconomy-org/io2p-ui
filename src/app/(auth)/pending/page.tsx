'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'
import { Button, Card } from '@/components/ui'
import { useSession } from '@/lib/auth/client'

// Approval happens in another app; the session only shows it when read again.
const RECHECK_MS = 30_000

/**
 * Where a social sign-up waits for an administrator (SIGNUP_APPROVAL=admin).
 * The account has a session but io2p-auth mints no core token for it, so
 * nothing else in the app can work yet.
 */
export default function PendingApprovalPage() {
  const t = useTranslations('auth.pending')
  const { userInfo, logout } = useAuth()
  const { refetch } = useSession()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => void refetch(), RECHECK_MS)
    return () => window.clearInterval(id)
  }, [refetch])

  const checkAgain = async () => {
    setChecking(true)
    try {
      await refetch()
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>

      <Card className="p-6 shadow-lg mt-8 space-y-6" data-testid="auth-pending">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {userInfo?.email
              ? t('bodyWithEmail', { email: userInfo.email })
              : t('body')}
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={checking}
          onClick={() => void checkAgain()}
          data-testid="auth-pending-check-again"
        >
          {t('checkAgain')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void logout()}
          data-testid="auth-pending-sign-out"
        >
          {t('signOut')}
        </Button>
      </Card>
    </>
  )
}
