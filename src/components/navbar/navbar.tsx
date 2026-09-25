'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Building2, ChevronDown, Search } from 'lucide-react'

import { CommandCenter, useCommandCenter } from '@/components/global-search'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSearch, useAppConfig } from '@/contexts'
import { NAV_ITEMS, anchor } from '@/constants'
import { NAV_ICONS } from './nav-icons'
import { NAV_MENU_TOGGLE_EVENT } from '@/components/onboarding/constants'
import { UserProfileDropdown } from './user-profile-dropdown'
import { MobileMenu } from './mobile-menu'

const emptySubscribe = () => () => {}

export default function Navbar() {
  const pathname = usePathname()
  const t = useTranslations()
  const isMac = useSyncExternalStore(
    emptySubscribe,
    () => navigator.platform.toUpperCase().indexOf('MAC') >= 0,
    () => false
  )
  const { searchQuery, isSearchMode, executeSearchFromParsed } = useSearch()
  const config = useAppConfig()

  const { open: commandCenterOpen, setOpen: setCommandCenterOpen } =
    useCommandCenter()

  // Which grouped nav menu is forced open. Normally null — Radix owns its own
  // open state — but a tour needs to show what is inside the group it is
  // highlighting.
  const [openNavMenu, setOpenNavMenu] = useState<string | null>(null)

  useEffect(() => {
    const handleToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; open: boolean }>)
        .detail
      if (!detail) return
      setOpenNavMenu(detail.open ? detail.key : null)
    }

    window.addEventListener(NAV_MENU_TOGGLE_EVENT, handleToggle)
    return () => window.removeEventListener(NAV_MENU_TOGGLE_EVENT, handleToggle)
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
                {...anchor('topNav')}
              >
                {NAV_ITEMS.map((item) => {
                  // A group is active when ANY child route is, so the parent still reads as "where
                  // you are" while the child owns the URL.
                  const active = item.children
                    ? item.children.some((c) => pathname.startsWith(c.path))
                    : pathname === item.path || pathname.startsWith(item.path)

                  const className = cn(
                    'text-sm font-medium transition-colors',
                    'hover:cursor-pointer hover:text-primary',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )

                  /**
                   * `prefetch` explicitly, not the default.
                   *
                   * Every route here is DYNAMIC (the root layout reads cookies
                   * for the locale and the preference mirror). On a dynamic
                   * route the default `auto` prefetches only "down to the
                   * nearest `loading.js` boundary" — i.e. it fetches the
                   * SKELETON and nothing else, so the click still waits for the
                   * page and you see that skeleton every single time, in
                   * production too. `true` prefetches the whole route, so the
                   * heading, filters and table frame are already on the client
                   * and only the ROWS wait, in `DataTable`'s own `fetching`
                   * state.
                   */
                  const Icon = item.icon ? NAV_ICONS[item.icon] : null

                  if (!item.children) {
                    return (
                      <Link
                        key={item.key}
                        href={item.path}
                        prefetch
                        data-tour={item.dataTour}
                        className={cn(className, 'flex items-center gap-1.5')}
                      >
                        {Icon ? (
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {t(`nav.${item.key}`)}
                      </Link>
                    )
                  }

                  return (
                    // Fully controlled rather than defaulting to Radix's own
                    // state: flipping between controlled and uncontrolled mid-life
                    // is what breaks these menus.
                    <DropdownMenu
                      key={item.key}
                      open={openNavMenu === item.key}
                      onOpenChange={(open) =>
                        setOpenNavMenu(open ? item.key : null)
                      }
                    >
                      <DropdownMenuTrigger
                        data-tour={item.dataTour}
                        className={cn(className, 'flex items-center gap-1.5')}
                      >
                        {Icon ? (
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {t(`nav.${item.key}`)}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                            ? NAV_ICONS[child.icon]
                            : null
                          return (
                            <DropdownMenuItem key={child.key} asChild>
                              <Link
                                href={child.path}
                                prefetch
                                className="flex items-center gap-2"
                              >
                                {ChildIcon ? (
                                  <ChildIcon
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                {t(`nav.${child.key}`)}
                              </Link>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                })}
              </nav>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setCommandCenterOpen(true)}
                {...anchor('searchButton')}
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
                  {/* Fixed width: the server snapshot renders 'Ctrl' and the
                      client may swap to '⌘'. suppressHydrationWarning silences
                      the warning but not the reflow — 4 glyphs to 1 visibly
                      shifts the hint. Reserving the wider box makes the swap
                      invisible. */}
                  <kbd
                    className="min-w-[1.9rem] px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm text-center"
                    suppressHydrationWarning
                  >
                    {isMac ? '⌘' : 'Ctrl'}
                  </kbd>
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                    K
                  </kbd>
                </div>
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
