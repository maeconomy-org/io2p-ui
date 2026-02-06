import { useTranslations } from 'next-intl'
import { Paperclip } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

interface PropertyGridViewProps {
  properties: any[]
}

export function PropertyGridView({ properties }: PropertyGridViewProps) {
  const t = useTranslations()

  if (!properties || properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('objects.noProperties')}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {properties.map((prop: any, idx: number) => {
        const values = prop.values || []
        const hasFiles =
          (prop.files && prop.files.length > 0) ||
          values.some((v: any) => v.files && v.files.length > 0)
        const totalFiles =
          (prop.files?.length || 0) +
          values.reduce(
            (sum: number, v: any) => sum + (v.files?.length || 0),
            0
          )

        return (
          <div
            key={prop.uuid || `prop-${idx}`}
            className={cn(
              'border-b border-border/50 pb-2.5',
              'last:border-b-0 [&:nth-last-child(2)]:border-b-0'
            )}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {prop.label || prop.key}
              </span>
              {hasFiles && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[10px] gap-0.5"
                >
                  <Paperclip className="h-2.5 w-2.5" />
                  {totalFiles}
                </Badge>
              )}
            </div>
            <div className="space-y-0.5">
              {values.length > 0 ? (
                values.map((value: any, vIdx: number) => (
                  <div
                    key={value.uuid || `val-${vIdx}`}
                    className="text-sm font-medium"
                  >
                    {value.value || (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground italic">—</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
