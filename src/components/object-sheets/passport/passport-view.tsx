'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Building2 } from 'lucide-react'

import { EmptyState } from '@/components/ui'

import {
  AddressCard,
  type PassportAddressInfo,
} from './components/address-card'
import { DocumentsStrip, type PassportFile } from './components/documents-strip'
import { LifecycleRibbon } from './components/lifecycle-ribbon'
import { PassportCategoryCard } from './components/passport-category-card'
import { PassportHero } from './components/passport-hero'
import { isPassportEmpty } from './utils/is-passport-empty'
import {
  groupPropertiesByCategory,
  type NormalizedProperty,
} from './utils/passport-utils'

export interface PassportViewProps {
  object: {
    uuid?: string
    name?: string
    abbreviation?: string
    description?: string
  } | null
  properties: NormalizedProperty[]
  files: PassportFile[]
  addressInfo: PassportAddressInfo | null
}

/**
 * Top-level passport renderer. Pure layout orchestration — every piece of
 * derivation lives in `./hooks` or `./utils` so this component is easy to
 * scan top-to-bottom.
 */
export function PassportView({
  object,
  properties,
  files,
  addressInfo,
}: PassportViewProps) {
  const t = useTranslations()
  const locale = useLocale()

  const groups = useMemo(
    () => groupPropertiesByCategory(properties, locale === 'nl' ? 'nl' : 'en'),
    [properties, locale]
  )

  if (isPassportEmpty({ properties, files, addressInfo })) {
    return (
      <div className="py-8" data-testid="passport-empty">
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title={t('objects.passport.emptyTitle')}
          description={t('objects.passport.emptyDescription')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-2" data-testid="passport-tab">
      <PassportHero object={object} properties={properties} />

      <LifecycleRibbon properties={properties} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <PassportCategoryCard key={group.category} group={group} />
        ))}
        <AddressCard addressInfo={addressInfo} />
      </div>

      <DocumentsStrip files={files} />
    </div>
  )
}
