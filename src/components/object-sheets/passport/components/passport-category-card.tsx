import { useTranslations } from 'next-intl'
import {
  Boxes,
  CircleDashed,
  FileText,
  Leaf,
  MapPin,
  Package,
  Ruler,
  ShieldCheck,
  Tag,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

import { isUrlValue } from '../utils/passport-formatters'
import type { CategoryGroup, PassportCategory } from '../utils/passport-utils'
import { PassportValue } from './passport-value'

const CATEGORY_ICON: Record<PassportCategory | 'other', typeof Package> = {
  product: Package,
  classification: Tag,
  dimensions: Ruler,
  composition: Boxes,
  appearance: CircleDashed,
  sustainability: Leaf,
  commerce: Tag,
  ownership: User,
  state: ShieldCheck,
  contact: User,
  location: MapPin,
  meta: FileText,
  other: FileText,
}

interface PassportCategoryCardProps {
  group: CategoryGroup
}

export function PassportCategoryCard({ group }: PassportCategoryCardProps) {
  const t = useTranslations()
  const Icon = CATEGORY_ICON[group.category] ?? FileText

  return (
    <Card
      data-testid={`passport-card-${group.category}`}
      className="passport-card"
    >
      <CardHeader className="py-3 px-3">
        <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {t(`objects.passport.categories.${group.category}`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {group.entries.map(({ property, displayLabel, displayValue }) => {
            // Long, URL-typed, or swatch-decorated values span both columns
            // so they don't get clipped by the ~120px cell width of a 2-col
            // compact card. The colour swatch eats ~18px on top of the text,
            // so colour entries always span 2 cols regardless of length.
            const isColor =
              property.key === 'color' || property.key === 'colour'
            const isLong =
              displayValue.length > 14 ||
              isUrlValue(property.key, displayValue) ||
              isColor
            return (
              <div
                key={property.uuid ?? property.key}
                className={cn(
                  'flex flex-col min-w-0',
                  isLong && 'sm:col-span-2'
                )}
              >
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground truncate leading-tight">
                  {displayLabel}
                </dt>
                <dd
                  className="text-sm font-medium leading-snug truncate"
                  title={displayValue}
                >
                  <PassportValue
                    propertyKey={property.key}
                    displayValue={displayValue}
                  />
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}
