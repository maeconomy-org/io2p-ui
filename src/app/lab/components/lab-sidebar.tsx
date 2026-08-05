'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  ChevronRight,
  Columns2,
  GitBranch,
  Import,
  LayoutDashboard,
  Library,
  MessageSquare,
  MessagesSquare,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useCommandCenter } from '@/components/global-search'
import { useSearch } from '@/contexts'

import { SearchCenter } from './search-center'

import { FeedbackDialog } from './feedback-dialog'
import { HelpMenu } from './help-menu'
import { NodeSwitcher } from './node-switcher'
import { SidebarProfile } from './sidebar-profile'
import {
  CustomizeSidebarDialog,
  type SidebarItemPrefs,
} from './customize-sidebar-dialog'

const NAV = [
  {
    id: 'overviews',
    href: '/lab/overviews',
    label: 'Overviews',
    icon: LayoutDashboard,
  },
  { id: 'objects', href: '/lab/objects', label: 'Objects', icon: Boxes },
  {
    id: 'processes',
    href: '/lab/processes',
    label: 'Processes',
    icon: GitBranch,
  },
  { id: 'shares', href: '/lab/shares', label: 'Shares', icon: Share2 },
  {
    id: 'library',
    href: '/lab/library',
    label: 'Library',
    icon: Library,
    children: [
      { href: '/lab/library/models', label: 'Models' },
      { href: '/lab/library/formulas', label: 'Formulas' },
      { href: '/lab/library/constants', label: 'Constants' },
    ],
  },
  { id: 'import', href: '/lab/import', label: 'Import', icon: Import },
  { id: 'views', href: '/lab/views', label: 'Views', icon: SlidersHorizontal },
  { id: 'browse', href: '/lab/browse', label: 'Browse', icon: Columns2 },
  { id: 'access', href: '/lab/access', label: 'Access', icon: ShieldCheck },
] as const

const AGENT = { href: '/lab/agent', label: 'Ask agent', icon: MessagesSquare }

const DEFAULT_PREFS: SidebarItemPrefs[] = [
  {
    id: 'overviews',
    label: 'Overviews',
    group: 'Workspace',
    visibility: 'always',
  },
  { id: 'objects', label: 'Objects', group: 'Workspace', visibility: 'always' },
  {
    id: 'processes',
    label: 'Processes',
    group: 'Workspace',
    visibility: 'always',
  },
  { id: 'shares', label: 'Shares', group: 'Workspace', visibility: 'always' },
  { id: 'library', label: 'Library', group: 'Workspace', visibility: 'always' },
  { id: 'import', label: 'Import', group: 'Tools', visibility: 'always' },
  { id: 'views', label: 'Views', group: 'Tools', visibility: 'always' },
  { id: 'browse', label: 'Browse', group: 'Tools', visibility: 'always' },
  { id: 'access', label: 'Access', group: 'Tools', visibility: 'always' },
]

export function LabSidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandCenter()
  const { searchQuery, isSearchMode } = useSearch()

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [customiseOpen, setCustomiseOpen] = useState(false)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [openGroup, setOpenGroup] = useState<string | null>('/lab/library')

  const isActive = (href: string) => pathname === href
  const hidden = new Set(
    prefs.filter((p) => p.visibility === 'never').map((p) => p.id)
  )

  return (
    <>
      <aside
        className={cn(
          'flex shrink-0 flex-col gap-1 transition-[width] duration-200',
          collapsed ? 'w-[3.75rem]' : 'w-60'
        )}
      >
        <div className="px-2 pt-2">
          <NodeSwitcher collapsed={collapsed} />
        </div>

        {/* Search was missing entirely — it lived in the navbar, and the sidebar replaced the
            navbar. Same CommandCenter, same ⌘K, so there is one search in the app, not two. */}
        <div className="px-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className={cn(
              'flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm text-muted-foreground transition-colors',
              'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'justify-center px-0'
            )}
          >
            <Search className="size-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">
                  {isSearchMode && searchQuery ? searchQuery : 'Search'}
                </span>
                <kbd className="rounded border bg-muted px-1 text-[10px]">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {NAV.filter((item) => !hidden.has(item.id)).map((item) => {
            const Icon = item.icon
            const children = 'children' in item ? item.children : undefined
            const groupOpen = openGroup === item.href
            const childActive = children?.some((c) => isActive(c.href))

            if (children) {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(groupOpen ? null : item.href)}
                    aria-expanded={groupOpen}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      collapsed && 'justify-center px-0',
                      childActive ? 'font-medium' : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight
                          className={cn(
                            'size-3.5 transition-transform',
                            groupOpen && 'rotate-90'
                          )}
                        />
                      </>
                    )}
                  </button>
                  {groupOpen && !collapsed && (
                    <div className="ml-[1.15rem] border-l pl-2">
                      {children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                            isActive(child.href)
                              ? 'bg-muted font-medium'
                              : 'text-muted-foreground'
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                  collapsed && 'justify-center px-0',
                  isActive(item.href)
                    ? 'bg-muted font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}

          {/* The agent sits apart from the entity nav — it is a different KIND of destination,
              and burying it in the list would make it read as one more table. */}
          <div className="pt-3">
            {!collapsed && (
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground/70">
                Assist
              </p>
            )}
            <Link
              href={AGENT.href}
              title={collapsed ? AGENT.label : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                collapsed && 'justify-center px-0',
                isActive(AGENT.href)
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <AGENT.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{AGENT.label}</span>}
            </Link>
          </div>
        </nav>

        <div className="space-y-0.5 px-2 pb-2">
          <button
            type="button"
            onClick={() => setCustomiseOpen(true)}
            title={collapsed ? 'Customise sidebar' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'justify-center px-0'
            )}
          >
            <Settings2 className="size-4 shrink-0" />
            {!collapsed && <span>Customise sidebar</span>}
          </button>

          {/* Feedback lives at the BOTTOM of the sidebar, not in the profile menu: it is about
              the page you are on, and a menu you have to open first is a menu you forget exists. */}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            title={collapsed ? 'Send feedback' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'justify-center px-0'
            )}
          >
            <MessageSquare className="size-4 shrink-0" />
            {!collapsed && <span>Send feedback</span>}
          </button>

          <div className={cn(collapsed && 'flex justify-center')}>
            <HelpMenu collapsed={collapsed} />
          </div>

          <div className="pt-1">
            <SidebarProfile collapsed={collapsed} />
          </div>
        </div>
      </aside>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <CustomizeSidebarDialog
        open={customiseOpen}
        onOpenChange={setCustomiseOpen}
        items={prefs}
        onChange={setPrefs}
      />
      {/* The lab's own search, not the app's CommandCenter — the whole point is to try a
          different one. `useCommandCenter` is still shared, so ⌘K opens this. */}
      <SearchCenter open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
