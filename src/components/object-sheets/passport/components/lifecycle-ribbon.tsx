import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Hourglass,
  Package,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Card, CardContent, Progress } from '@/components/ui'

import { useLifecycle } from '../hooks/use-lifecycle'
import { formatDate } from '../utils/format-date'
import { formatDurationDays } from '../utils/format-duration'
import type { NormalizedProperty } from '../utils/passport-utils'
import { LifecycleStat } from './lifecycle-stat'

interface LifecycleRibbonProps {
  properties: NormalizedProperty[]
}

/**
 * Lifecycle ribbon — surfaces date-based properties (warranty, maintenance,
 * inspection, age) with progress bars and relative-time hints. Hidden when
 * none of the lifecycle keys exist on the object.
 */
export function LifecycleRibbon({ properties }: LifecycleRibbonProps) {
  const t = useTranslations()
  const locale = useLocale()
  const {
    productionDate,
    lastInspection,
    nextMaintenance,
    warrantyProgress,
    ageDays,
    lifespanYears,
    hasAny,
  } = useLifecycle(properties)

  if (!hasAny) return null

  const today = Date.now()
  const isMaintenanceOverdue =
    !!nextMaintenance && nextMaintenance.getTime() < today

  return (
    <Card data-testid="passport-lifecycle-ribbon">
      <CardContent className="space-y-2.5 px-3.5 pt-2.5 pb-2.5">
        {warrantyProgress && (
          <div data-testid="passport-warranty">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-primary" />
                {t('objects.passport.lifecycle')}
                <span className="mx-1 text-muted-foreground/60">·</span>
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('objects.passport.warranty')}
                </span>
              </span>
              {warrantyProgress.isOverdue ? (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t('objects.passport.expired')}
                </Badge>
              ) : warrantyProgress.percent >= 90 ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-5 px-1.5">
                  {t('objects.passport.expiresIn', {
                    days: warrantyProgress.daysRemaining,
                  })}
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] h-5 px-1.5">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t('objects.passport.active')}
                </Badge>
              )}
            </div>
            <Progress
              value={warrantyProgress.percent}
              className={cn(
                'h-2',
                warrantyProgress.isOverdue && '[&>div]:bg-destructive',
                !warrantyProgress.isOverdue &&
                  warrantyProgress.percent >= 90 &&
                  '[&>div]:bg-amber-500'
              )}
              data-testid="passport-warranty-progress"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
              <span>{formatDate(warrantyProgress.from, locale)}</span>
              <span>
                {t('objects.passport.percentElapsed', {
                  percent: warrantyProgress.percent,
                })}
              </span>
              <span>{formatDate(warrantyProgress.to, locale)}</span>
            </div>
          </div>
        )}

        {!warrantyProgress && (
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            {t('objects.passport.lifecycle')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 text-sm">
          {ageDays !== null && (
            <LifecycleStat
              icon={CalendarDays}
              label={t('objects.passport.inService')}
              value={formatDurationDays(ageDays, t)}
              testId="passport-age"
            />
          )}
          {productionDate && (
            <LifecycleStat
              icon={Package}
              label={t('objects.passport.produced')}
              value={formatDate(productionDate, locale)}
            />
          )}
          {lastInspection && (
            <LifecycleStat
              icon={CheckCircle2}
              label={t('objects.passport.lastInspection')}
              value={formatDate(lastInspection, locale)}
            />
          )}
          {nextMaintenance && (
            <LifecycleStat
              icon={Wrench}
              label={t('objects.passport.nextMaintenance')}
              value={formatDate(nextMaintenance, locale)}
              highlight={isMaintenanceOverdue}
            />
          )}
          {lifespanYears && (
            <LifecycleStat
              icon={Hourglass}
              label={t('objects.passport.expectedLifespan')}
              value={t('objects.passport.years', {
                count: Number(lifespanYears) || lifespanYears,
              })}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
