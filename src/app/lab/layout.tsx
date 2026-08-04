'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { LabSidebar } from './components/lab-sidebar'

/**
 * Inset layout — the sidebar sits on the page background and the content floats in a rounded,
 * bordered card beside it.
 *
 * The gain is not decoration: a content region with its OWN edges can scroll independently and
 * pin its own header. A full-bleed main with a single divider gives a sticky table header nothing
 * to sit against.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="group/shell relative flex h-screen overflow-hidden bg-muted/40">
      <LabSidebar collapsed={collapsed} />

      {/* The toggle lives on the BOUNDARY, not inside the sidebar.
          Inside, it had to survive the sidebar shrinking to a 60px rail — competing with the nav
          icons for the single column they share — and when collapsed it is the one control whose
          entire job is "make this wider", so cramming it into the narrow state is backwards. On
          the seam its position is the same at every width, and it reveals on hover the way a
          resize handle does. Focus reveals it too, so it is not mouse-only. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className={cn(
          'absolute top-4 z-20 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-all',
          'opacity-0 group-hover/shell:opacity-100 focus-visible:opacity-100',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed ? 'left-[3.4rem]' : 'left-[14.25rem]'
        )}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>

      <main className="min-w-0 flex-1 overflow-hidden p-2 pl-0">
        <div className="h-full overflow-y-auto rounded-xl border bg-background shadow-sm">
          {children}
        </div>
      </main>
    </div>
  )
}
