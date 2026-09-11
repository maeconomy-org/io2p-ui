import { TableSkeleton } from '@/components/skeletons'

// The page opens on the jobs list, so the table skeleton is what the first paint becomes.
export default function Loading() {
  return <TableSkeleton />
}
