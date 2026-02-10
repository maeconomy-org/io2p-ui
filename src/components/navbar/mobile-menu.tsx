'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Building2,
  LogOut,
  Menu,
  ChevronRight,
  Shield,
  Search,
  User,
  Sun,
  Moon,
  Monitor,
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
import { cn } from '@/lib/utils'
import { useAuth, useAppConfig } from '@/contexts'
import { NAV_ITEMS } from '@/constants'

const LOCALES = [
  { value: 'en', label: 'EN' },
  { value: 'nl', label: 'NL' },
] as const

const THEMES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const

interface MobileMenuProps {
  onSearchOpen: () => void
}

export function MobileMenu({ onSearchOpen }: MobileMenuProps) {
  const pathname = usePathname()
  const t = useTranslations()
  const themeT = useTranslations('theme')
  const [isOpen, setIsOpen] = useState(false)
  const { userInfo, logout } = useAuth()
  const config = useAppConfig()
  const locale = useLocale()
  const { theme, setTheme } = useTheme()

  const handleLocaleChange = useCallback((value: string) => {
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${60 * 60 * 24 * 365}`
    window.location.reload()
  }, [])

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
              {NAV_ITEMS.map((item) => (
                <SheetClose asChild key={item.path}>
                  <Link
                    href={item.path}
                    data-tour={item.dataTour}
                    className={cn(
                      'flex items-center justify-between py-3 px-4 hover:bg-muted transition-colors',
                      pathname === item.path || pathname.startsWith(item.path)
                        ? 'bg-muted text-primary font-medium'
                        : 'text-foreground'
                    )}
                  >
                    <span>{t(`nav.${item.key}`)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </SheetClose>
              ))}
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
                    {userInfo?.certificateInfo.subjectFields.CN ||
                      t('nav.user')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Shield className="h-2.5 w-2.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-[10px] text-muted-foreground truncate">
                      {t('nav.certificateAuthenticated')}
                    </span>
                  </div>
                </div>
                {userInfo?.userUUID && (
                  <CopyButton
                    text={userInfo.userUUID}
                    className="h-6 w-6 p-0 shrink-0"
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* Sign Out */}
            <div className="px-4 py-3">
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
