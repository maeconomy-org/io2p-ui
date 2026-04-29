import { useTranslations } from 'next-intl'
import { IdCard } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'

import { getStatusBadgeClasses } from '../utils/passport-formatters'
import {
  findValueByKey,
  type NormalizedProperty,
} from '../utils/passport-utils'

interface HeroObject {
  uuid?: string
  name?: string
  abbreviation?: string
  description?: string
}

interface PassportHeroProps {
  object: HeroObject | null
  properties: NormalizedProperty[]
}

export function PassportHero({ object, properties }: PassportHeroProps) {
  const t = useTranslations()
  const manufacturer = findValueByKey(properties, 'manufacturer')
  const model = findValueByKey(properties, 'model')
  const serial = findValueByKey(properties, 'serial-number')
  const status = findValueByKey(properties, 'status')
  const category = findValueByKey(properties, 'category')

  const subtitle = [manufacturer, model].filter(Boolean).join(' · ')

  return (
    <div
      className="rounded-lg border bg-gradient-to-br from-primary/5 via-background to-background px-3 py-2.5"
      data-testid="passport-hero"
    >
      <div className="flex items-start gap-2.5">
        <div className="rounded-md bg-primary/10 p-1.5 flex-shrink-0">
          <IdCard className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-base font-semibold truncate leading-tight">
              {object?.name || t('objects.passport.untitled')}
            </h2>
            {object?.abbreviation && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {object.abbreviation}
              </Badge>
            )}
            {status && (
              <Badge
                className={cn(
                  'text-[10px] h-4 px-1.5',
                  getStatusBadgeClasses(status)
                )}
              >
                {status}
              </Badge>
            )}
            {category && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {category}
              </Badge>
            )}
          </div>
          {(subtitle || serial) && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {subtitle}
              {subtitle && serial && (
                <span className="mx-1.5 text-muted-foreground/60">·</span>
              )}
              {serial && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono">SN {serial}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('objects.passport.serialTooltip')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </p>
          )}
          {object?.description && (
            <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">
              {object.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
