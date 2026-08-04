'use client'

import {
  BookOpen,
  CircleHelp,
  ExternalLink,
  Keyboard,
  LifeBuoy,
  Search,
} from 'lucide-react'

import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'

const SHORTCUTS = [
  { label: 'Search everything', keys: '⌘K' },
  { label: 'New object', keys: '⌘N' },
  { label: 'Toggle theme', keys: '⌘⇧L' },
]

const LINKS = [
  { label: 'Documentation', icon: BookOpen, external: true },
  { label: 'Contact support', icon: LifeBuoy, external: true },
]

/**
 * A help affordance that is PERMANENT, unlike the tours.
 *
 * The onboarding walkthroughs run once and are hard to find again; a question mark pinned to the
 * sidebar is re-readable at the moment someone is stuck, which is a different job. Search sits at
 * the top because "how do I…" is the question people actually arrive with.
 */
export function HelpMenu({ collapsed }: { collapsed: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Help"
          >
            <CircleHelp className="size-4" />
          </Button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CircleHelp className="size-4 shrink-0" />
            Help
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-72 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help…"
              className="h-8 pl-8 text-sm"
              aria-label="Search help"
            />
          </div>
        </div>

        <div className="border-b p-2">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            Shortcuts
          </p>
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <Keyboard className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">{shortcut.label}</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-2">
          {LINKS.map((link) => {
            const Icon = link.icon
            return (
              <button
                key={link.label}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{link.label}</span>
                {link.external && (
                  <ExternalLink className="size-3 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
