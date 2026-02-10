import { Skeleton } from '@/components/ui'

export function NavbarSkeleton() {
  return (
    <header className="border-b bg-background top-0 z-10">
      <div className="container mx-auto py-3 px-4">
        <div className="flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-12" />
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </nav>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Skeleton className="h-9 w-[200px] lg:w-[280px] rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <Skeleton className="h-9 w-9 rounded" />
          </div>
        </div>
      </div>
    </header>
  )
}
