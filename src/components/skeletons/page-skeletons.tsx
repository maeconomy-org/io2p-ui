import { Skeleton } from '@/components/ui'

/**
 * Content-area skeleton for route transitions on NON-table pages.
 * The real Navbar is rendered by ClientLayout and stays put across
 * transitions, so this covers the content area only.
 *
 * List routes should use TableSkeleton instead — a card/box shape in front of
 * a table costs a visible reflow when the real content arrives.
 */
export function ContentSkeleton() {
  return (
    <div className="container mx-auto p-4 flex-1" data-testid="page-skeleton">
      {/* Page header area */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-44" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Content area — simple rounded boxes */}
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Mirrors DataTable's own loading rows, so a route transition into a list page
 * shows the same shape the table will show, and then the data — one shape, not
 * three. Header bar + toolbar + rows, matching the real layout's rhythm.
 */
export function TableSkeleton() {
  return (
    <div className="container mx-auto p-4 flex-1" data-testid="page-skeleton">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-44" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="flex items-center gap-4 border-b px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-b px-4 py-3.5">
            {Array.from({ length: 5 }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
