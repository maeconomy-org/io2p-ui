'use client'

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  Copy,
  LogOut,
  Settings,
  Shield,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { useAuth } from '@/contexts'

import { SeededAvatar } from './seeded-avatar'

/**
 * The shadcn footer pattern, with one substitution that matters here.
 *
 * That pattern shows name over email. This app authenticates with an mTLS CERTIFICATE, so many
 * accounts have no email at all — and a uuid is not a substitute. `019f5a7e-600d-77b5-b8…` tells
 * a non-technical user nothing, so the second line falls back to HOW they signed in rather than
 * to an identifier only support can use. The id lives behind a copy action, where it belongs.
 */
export function SidebarProfile({ collapsed }: { collapsed: boolean }) {
  const { userInfo, userId, logout } = useAuth()

  const certificateName =
    userInfo?.certificateInfo?.subjectFields?.CN ||
    userInfo?.certificateInfo?.issuerFields?.CN

  const name =
    userInfo?.username || certificateName || userInfo?.credentialValue || 'You'

  const initials = name.slice(0, 2).toUpperCase()
  const viaCertificate = userInfo?.identifierType !== 'UserAuthUP'
  const email = userInfo?.credentialValue?.includes('@')
    ? userInfo.credentialValue
    : undefined

  // Email if there is one, otherwise how they authenticated. Never the uuid.
  const secondary =
    email ?? (viaCertificate ? 'Signed in with a certificate' : 'Signed in')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label="Account menu"
        >
          <SeededAvatar seed={userId ?? name} label={initials} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">
                  {name}
                </span>
                <span className="block truncate text-xs leading-tight text-muted-foreground">
                  {secondary}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <SeededAvatar
              seed={userId ?? name}
              label={initials}
              className="size-8"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {viaCertificate ? (
                  <Shield className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <BadgeCheck className="size-3 shrink-0 text-sky-600 dark:text-sky-400" />
                )}
                <span className="truncate">{secondary}</span>
              </span>
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2">
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2">
          <Bell className="size-4" />
          Notifications
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        {/* The id is not identity, but it IS what support asks for. Behind a deliberate click
            rather than on the face of the menu. */}
        {userId && (
          <DropdownMenuItem
            className="gap-2 text-muted-foreground"
            onClick={() => navigator.clipboard?.writeText(userId)}
          >
            <Copy className="size-4" />
            Copy account id
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => logout()}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
