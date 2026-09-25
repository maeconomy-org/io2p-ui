import {
  Boxes,
  FunctionSquare,
  GitBranch,
  FilePen,
  Import,
  Library,
  Ruler,
  Share2,
  Sigma,
  type LucideIcon,
} from 'lucide-react'

import { NAV_ITEMS, type NavIcon } from '@/constants'
import type { TourIcon } from '@/components/onboarding/tour-registry'

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

/** Icons a route cannot supply, for a second tour on a route already claimed. */
const TOUR_ICONS: Record<TourIcon, LucideIcon> = {
  drafts: FilePen,
}

/**
 * The icon a walkthrough shows in the profile menu.
 *
 * The page's own mark by default — the one the user already knows from the
 * navbar — so the row says WHERE as well as what. Reading it from `NAV_ITEMS`
 * rather than a second table means a route can only ever carry one icon, and
 * `override` covers the case that breaks: two tours on the same route, which
 * otherwise stack two identical marks.
 */
export function tourIcon(
  route: string,
  override?: TourIcon
): LucideIcon | undefined {
  if (override) return TOUR_ICONS[override]
  const flat = NAV_ITEMS.flatMap((item) => [item, ...(item.children ?? [])])
  const icon = flat.find((item) => item.path === route)?.icon
  return icon ? NAV_ICONS[icon] : undefined
}
