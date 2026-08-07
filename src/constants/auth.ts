import {
  Boxes,
  ArrowLeftRight,
  Layers,
  FileUp,
  Recycle,
  Package,
  MapPin,
  Truck,
  Hammer,
  FileSpreadsheet,
  Database,
  FileCode,
  RotateCcw,
  Leaf,
  Building2,
  Ruler,
  Scale,
  type LucideIcon,
} from 'lucide-react'

export const PUBLIC_PAGES: string[] = [
  '/',
  '/help',
  '/security',
  '/terms',
  '/privacy',
  '/forgot-password',
  '/reset-password',
  '/two-factor',
]
export const PUBLIC_PAGES_SET = new Set(PUBLIC_PAGES)

export type AuthScene = {
  id: string
  icon: LucideIcon
  accent: string
  secondaryIcons: readonly LucideIcon[]
}

export const AUTH_SCENES: readonly AuthScene[] = [
  {
    id: 'objects',
    icon: Boxes,
    accent: 'from-blue-500/40 via-cyan-400/30 to-transparent',
    secondaryIcons: [Package, Ruler, MapPin],
  },
  {
    id: 'processes',
    icon: ArrowLeftRight,
    accent: 'from-emerald-500/40 via-teal-400/30 to-transparent',
    secondaryIcons: [Hammer, Truck, Recycle],
  },
  {
    id: 'models',
    icon: Layers,
    accent: 'from-violet-500/40 via-fuchsia-400/30 to-transparent',
    secondaryIcons: [FileCode, Building2, Scale],
  },
  {
    id: 'import',
    icon: FileUp,
    accent: 'from-amber-500/40 via-orange-400/30 to-transparent',
    secondaryIcons: [FileSpreadsheet, Database, FileCode],
  },
  {
    id: 'lifecycle',
    icon: Recycle,
    accent: 'from-lime-500/40 via-green-400/30 to-transparent',
    secondaryIcons: [RotateCcw, Leaf, ArrowLeftRight],
  },
] as const
