'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  LogOut,
  Menu,
  ChevronRight,
  Shield,
  Mail,
  Search,
  Settings,
  User,
  Sun,
  Moon,
} from 'lucide-react'

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  CopyButton,
  Separator,
} from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { useSetLocale } from '@/hooks/ui/use-set-locale'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, type NavItem } from '@/constants'
import { NAV_ICONS } from './nav-icons'
import { useAuth, useAppConfig } from '@/contexts'

const LOCALES = [
  { value: 'en', label: 'EN' },
  { value: 'nl', label: 'NL' },
] as const

const THEMES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const

interface MobileMenuProps {
  onSearchOpen: () => void
}

export function MobileMenu({ onSearchOpen }: MobileMenuProps) {
  const pathname = usePathname()
  const t = useTranslations()
  const themeT = useTranslations('theme')
  const [isOpen, setIsOpen] = useState(false)
  const { userInfo, logout, userId } = useAuth()
  const config = useAppConfig()
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const setLocale = useSetLocale()

  const displayIdentity =
    userInfo?.username ||
    userInfo?.identifier ||
    userInfo?.credentialValue ||
    userInfo?.credentials ||
    t('nav.user')

  const handleLocaleChange = useCallback(
    (value: string) => setLocale(value as 'en' | 'nl'),
    [setLocale]
  )

  return (
    <>
      {/* Mobile Search Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onSearchOpen}
        aria-label={t('common.search')}
      >
        <Search className="h-5 w-5" />
      </Button>

      {/* Mobile Menu Trigger */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-[80vw] sm:w-[350px] p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>{config.appAcronym}</span>
            </SheetTitle>
          </SheetHeader>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <nav className="flex flex-col py-2">
              {/* A group renders as a labelled section rather than a dropdown: there is room to
                  list the children outright, and a menu inside a menu is worse on touch. */}
              {NAV_ITEMS.map((item) =>
                item.children ? (
                  <div key={item.key} className="py-1">
                    <p className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`nav.${item.key}`)}
                    </p>
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        item={child}
                        pathname={pathname}
                        label={t(`nav.${child.key}`)}
                        indented
                      />
                    ))}
                  </div>
                ) : (
                  <NavLink
                    key={item.path}
                    item={item}
                    pathname={pathname}
                    label={t(`nav.${item.key}`)}
                  />
                )
              )}
            </nav>
          </div>

          {/* Bottom Section */}
          <div className="border-t bg-muted/30">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                {LOCALES.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => handleLocaleChange(item.value)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded transition-colors',
                      locale === item.value
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Theme toggle */}
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                {THEMES.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setTheme(item.value)}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      theme === item.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={themeT(item.value)}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* User info */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {displayIdentity}
                  </span>
                  {userInfo?.username && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {userInfo.username}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    {userInfo?.identifierType === 'UserAuthUP' ? (
                      <>
                        <Mail className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {t('nav.emailAuthenticated')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-2.5 w-2.5 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {t('nav.certificateAuthenticated')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {userId && (
                  <CopyButton text={userId} className="h-6 w-6 p-0 shrink-0" />
                )}
              </div>
            </div>

            <Separator />

            {/* Settings + Sign Out */}
            <div className="px-4 py-3 space-y-1">
              <SheetClose asChild>
                <Link
                  href="/settings"
                  data-testid="mobile-nav-settings"
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                    pathname === '/settings'
                      ? 'bg-muted text-primary'
                      : 'text-foreground'
                  )}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t('nav.settings')}
                </Link>
              </SheetClose>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setIsOpen(false)
                  logout()
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('nav.signOut')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** One navigation row. Closes the sheet on tap, since navigating away is always the intent. */
function NavLink({
  item,
  pathname,
  label,
  indented,
}: {
  item: NavItem
  pathname: string
  label: string
  indented?: boolean
}) {
  const active = pathname === item.path || pathname.startsWith(item.path)
  const Icon = item.icon ? NAV_ICONS[item.icon] : null
  return (
    <SheetClose asChild>
      <Link
        href={item.path}
        prefetch
        data-tour={item.dataTour}
        className={cn(
          'flex items-center justify-between py-3 px-4 hover:bg-muted transition-colors',
          indented && 'pl-8',
          active ? 'bg-muted text-primary font-medium' : 'text-foreground'
        )}
      >
        <span className="flex items-center gap-2.5">
          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
          {label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </SheetClose>
  )
}
