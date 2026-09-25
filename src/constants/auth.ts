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
  KeyRound,
  type LucideIcon,
} from 'lucide-react'

import { GoogleIcon, MicrosoftIcon } from '@/components/ui/brand-icons'

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

export type SocialProviderId = 'google' | 'microsoft'

export type SocialProvider = {
  /** better-auth provider id, passed straight to `signIn.social`. */
  id: SocialProviderId
  Icon: (props: { className?: string }) => React.JSX.Element
  /** Leaf under `auth.social.*` holding the button label. */
  labelKey: SocialProviderId
}

export const SOCIAL_PROVIDERS: readonly SocialProvider[] = [
  { id: 'google', Icon: GoogleIcon, labelKey: 'google' },
  { id: 'microsoft', Icon: MicrosoftIcon, labelKey: 'microsoft' },
] as const

/**
 * The providers a deployer has enabled, in registry order. Anything in the
 * config that this build has no mark or label for is dropped rather than
 * rendered as a nameless button.
 */
export function enabledSocialProviders(
  configured: string
): readonly SocialProvider[] {
  const ids = new Set(
    configured
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean)
  )
  return SOCIAL_PROVIDERS.filter((p) => ids.has(p.id))
}

/**
 * A credential row as `list-accounts` reports it. `providerId` is an open
 * string: the social ids above, `credential` for a password, and anything a
 * future issuer plugin registers.
 *
 * A brand mark is a component; a fallback is a lucide icon. They are different
 * shapes, so the consumer picks by `branded` rather than rendering one slot.
 */
export type CredentialDescriptor =
  | { branded: true; Icon: SocialProvider['Icon']; labelKey: string }
  | { branded: false; Icon: LucideIcon; labelKey: string }

export function describeCredential(providerId: string): CredentialDescriptor {
  const social = SOCIAL_PROVIDERS.find((p) => p.id === providerId)
  if (social) return { branded: true, Icon: social.Icon, labelKey: social.id }
  if (providerId === 'credential') {
    return { branded: false, Icon: KeyRound, labelKey: 'credential' }
  }
  return { branded: false, Icon: KeyRound, labelKey: 'unknown' }
}
