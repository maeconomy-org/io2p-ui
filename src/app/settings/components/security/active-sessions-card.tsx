'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Monitor, X, LogOut } from 'lucide-react'

import { logger } from '@/lib/observability/logger'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { authClient, useSession } from '@/lib/auth/client'
import { Card, CardContent, Button, Badge } from '@/components/ui'

interface SessionRow {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string | Date
}

function matchFirst(ua: string, pairs: [RegExp, string][]): string {
  for (const [re, name] of pairs) {
    if (re.test(ua)) return name
  }
  return ''
}

/** Friendly "Browser · OS" from a raw user-agent (no library). */
function describeUserAgent(ua?: string | null): string | null {
  if (!ua) return null
  const os = matchFirst(ua, [
    [/Windows/i, 'Windows'],
    [/Mac OS X|Macintosh/i, 'macOS'],
    [/iPhone|iPad/i, 'iOS'],
    [/Android/i, 'Android'],
    [/Linux/i, 'Linux'],
  ])
  const browser = matchFirst(ua, [
    [/Edg\//i, 'Edge'],
    [/OPR\/|Opera/i, 'Opera'],
    [/Chrome\//i, 'Chrome'],
    [/Firefox\//i, 'Firefox'],
    [/Safari\//i, 'Safari'],
  ])
  if (browser && os) return `${browser} · ${os}`
  return browser || os || null
}

export function ActiveSessionsCard() {
  const t = useTranslations('settings.security')
  const { data: sessionData } = useSession()
  const {
    data: sessions,
    isPending,
    refetch,
  } = useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: async ({ signal }) => {
      const { data, error } = await authClient.listSessions({
        fetchOptions: { signal },
      })
      if (error) {
        throw new Error(error.message)
      }
      return data ?? []
    },
  })
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingOthers, setRevokingOthers] = useState(false)

  const currentToken = sessionData?.session?.token

  const revokeOne = async (token: string) => {
    setRevoking(token)
    try {
      const { error } = await authClient.revokeSession({ token })
      if (error) {
        throw new Error(error.message)
      }
      toast.success(t('sessions.revoked'))
      refetch()
    } catch (err) {
      logger.error('Revoke session error:', { err })
      toast.error(t('sessions.revokeError'))
    } finally {
      setRevoking(null)
    }
  }

  const revokeOthers = async () => {
    setRevokingOthers(true)
    try {
      const { error } = await authClient.revokeOtherSessions()
      if (error) {
        throw new Error(error.message)
      }
      toast.success(t('sessions.revokedOthers'))
      refetch()
    } catch (err) {
      logger.error('Revoke other sessions error:', { err })
      toast.error(t('sessions.revokeError'))
    } finally {
      setRevokingOthers(false)
    }
  }

  // Current session pinned to the top, then newest first.
  const rows = [...((sessions ?? []) as SessionRow[])].sort((a, b) => {
    if (a.token === currentToken) return -1
    if (b.token === currentToken) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  const hasOthers = rows.some((s) => s.token !== currentToken)

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
        <div className="md:w-1/3">
          <h3 className="text-sm font-medium">{t('sessions.title')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('sessions.description')}
          </p>
        </div>
        <div className="flex-1 space-y-3">
          {hasOthers && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={revokeOthers}
                disabled={revokingOthers}
              >
                {revokingOthers ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                {t('sessions.signOutOthers')}
              </Button>
            </div>
          )}
          {isPending && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('sessions.loading')}
            </p>
          ) : (
            rows.map((s) => {
              const isCurrent = s.token === currentToken
              return (
                <div
                  key={s.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate text-sm font-medium"
                        title={s.userAgent ?? undefined}
                      >
                        {describeUserAgent(s.userAgent) ??
                          t('sessions.unknownDevice')}
                      </span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('sessions.thisDevice')}
                        </Badge>
                      )}
                    </div>
                    {s.ipAddress && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.ipAddress}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7 shrink-0', isCurrent && 'invisible')}
                    aria-label={t('sessions.revoke')}
                    disabled={isCurrent || revoking === s.token}
                    onClick={() => revokeOne(s.token)}
                  >
                    {revoking === s.token ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
