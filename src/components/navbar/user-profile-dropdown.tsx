'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  LogOut,
  ChevronDown,
  Shield,
  Hash,
  User,
  RocketIcon,
  Mail,
} from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  CopyButton,
} from '@/components/ui'
import { useAuth } from '@/contexts'
import {
  DEMO_TOUR_START_EVENT,
  USER_MENU_TOGGLE_EVENT,
} from '@/components/onboarding/constants'
import { LanguageDropdownItem } from '@/components/language-switcher'
import { ThemeDropdownItem } from '@/components/ui/theme-toggle'

export function UserProfileDropdown() {
  const t = useTranslations()
  const { userInfo, logout } = useAuth()

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const displayIdentity =
    userInfo?.certificateInfo?.subjectFields?.CN ||
    (userInfo as any)?.credentialValue ||
    (userInfo as any)?.usernamePasswordCredentials?.username ||
    (userInfo as any)?.usernamePasswordCredentials?.credentialValue ||
    userInfo?.credentials ||
    t('nav.user')

  useEffect(() => {
    const handleToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      if (typeof detail?.open === 'boolean') {
        setIsUserMenuOpen(detail.open)
      }
    }

    window.addEventListener(USER_MENU_TOGGLE_EVENT, handleToggle)
    return () =>
      window.removeEventListener(USER_MENU_TOGGLE_EVENT, handleToggle)
  }, [])

  return (
    <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 px-3 h-auto hover:bg-muted/50 transition-colors"
          data-tour="user-menu-trigger"
        >
          <User className="h-4 w-4 text-primary" />
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium max-w-32 truncate leading-tight">
              {displayIdentity}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center space-x-3 py-2">
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none">
                {displayIdentity}
              </p>
              <div className="flex items-center gap-1">
                {userInfo?.certificateInfo ? (
                  <>
                    <Shield className="h-3 w-3 text-green-600" />
                    <p className="text-xs leading-none text-muted-foreground">
                      {t('nav.certificateAuthenticated')}
                    </p>
                  </>
                ) : (
                  <>
                    <Mail className="h-3 w-3 text-blue-600" />
                    <p className="text-xs leading-none text-muted-foreground">
                      {t('nav.emailAuthenticated')}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* User UUID */}
        {userInfo?.userUUID && (
          <DropdownMenuItem
            className="flex flex-col items-start p-3 hover:bg-muted/50"
            onSelect={(e) => e.preventDefault()}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t('nav.userUuid')}
                </span>
              </div>
              <CopyButton text={userInfo.userUUID} className="h-6 w-6 p-0" />
            </div>
            <code className="text-xs bg-muted/30 py-1 rounded w-full block truncate font-mono">
              {userInfo.userUUID}
            </code>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          data-tour="demo-tour"
          onClick={() =>
            window.dispatchEvent(new CustomEvent(DEMO_TOUR_START_EVENT))
          }
          className="cursor-pointer"
        >
          <RocketIcon className="h-4 w-4 mr-2" />
          <span>{t('nav.demoWalkthrough')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <LanguageDropdownItem />
        <DropdownMenuSeparator />
        <ThemeDropdownItem />
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={logout}
          className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span className="font-medium">{t('nav.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
