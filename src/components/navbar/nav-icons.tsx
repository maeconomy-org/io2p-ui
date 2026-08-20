import {
  Boxes,
  FunctionSquare,
  GitBranch,
  Import,
  Library,
  Ruler,
  Share2,
  Sigma,
  type LucideIcon,
} from 'lucide-react'

import type { NavIcon } from '@/constants'

/**
 * Resolves `NavItem.icon` — a name in `site.ts`, so that data module stays free
 * of the React runtime. Names come from the `design/concepts` sidebar; the two
 * library leaves and `rollupRules` postdate it: Sigma is a summation, which is
 * what a rollup does.
 */
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  objects: Boxes,
  processes: GitBranch,
  shares: Share2,
  library: Library,
  formulas: FunctionSquare,
  constants: Ruler,
  rollupRules: Sigma,
  import: Import,
}
