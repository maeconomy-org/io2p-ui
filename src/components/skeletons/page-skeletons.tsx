import { Skeleton } from '@/components/ui'

/**
 * Content-area skeleton used during auth checks and route transitions.
 * Does NOT include a navbar skeleton — the real Navbar is rendered
 * by ClientLayout independently. For SDK init (before ClientLayout
 * mounts), QueryProvider renders NavbarSkeleton + ContentSkeleton directly.
 */
export function ContentSkeleton() {
  return (
    <div className="container mx-auto p-4 flex-1">
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
 * Full app shell skeleton with navbar — ONLY used by QueryProvider
 * during SDK initialization (before ClientLayout mounts).
 */
export { NavbarSkeleton } from './navbar-skeleton'
