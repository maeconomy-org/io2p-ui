'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Building2, Search } from 'lucide-react'

import { CommandCenter, useCommandCenter } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSearch, useAppConfig } from '@/contexts'
import { NAV_ITEMS } from '@/constants'
import { UserProfileDropdown } from './user-profile-dropdown'
import { MobileMenu } from './mobile-menu'

export default function Navbar() {
  const pathname = usePathname()
  const t = useTranslations()
  const [isMac, setIsMac] = useState(false)
  const { searchQuery, isSearching, isSearchMode, executeSearchFromParsed } =
    useSearch()
  const config = useAppConfig()

  const { open: commandCenterOpen, setOpen: setCommandCenterOpen } =
    useCommandCenter()

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  return (
    <>
      <header className="border-b bg-background top-0 z-10">
        <div className="container mx-auto py-3 px-4">
          <div className="flex items-center justify-between">
            {/* Logo & Desktop Nav */}
            <div className="flex items-center gap-8">
              <Link href="/objects">
                <div className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  <span className="font-bold text-xl">{config.appAcronym}</span>
                </div>
              </Link>

              <nav
                className="hidden md:flex items-center gap-6"
                data-tour="top-nav"
              >
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.key}
                    href={item.path}
                    data-tour={item.dataTour}
                    className={cn(
                      'text-sm font-medium transition-colors',
                      'hover:cursor-pointer hover:text-primary',
                      pathname === item.path || pathname.startsWith(item.path)
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setCommandCenterOpen(true)}
                data-tour="search-button"
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
                  'bg-muted/50 hover:bg-muted border-border/50 hover:border-border',
                  'text-muted-foreground hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'min-w-[200px] lg:min-w-[280px] max-w-[320px]'
                )}
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left text-sm truncate">
                  {isSearchMode && searchQuery
                    ? searchQuery
                    : t('common.search') + '...'}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                    {isMac ? '⌘' : 'Ctrl'}
                  </kbd>
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                    K
                  </kbd>
                </div>
                {isSearching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0"></div>
                )}
              </button>

              <UserProfileDropdown />
            </div>

            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <MobileMenu onSearchOpen={() => setCommandCenterOpen(true)} />
            </div>
          </div>
        </div>
      </header>

      <CommandCenter
        open={commandCenterOpen}
        onOpenChange={setCommandCenterOpen}
        onSearch={executeSearchFromParsed}
        initialQuery={isSearchMode ? searchQuery : ''}
      />
    </>
  )
}
