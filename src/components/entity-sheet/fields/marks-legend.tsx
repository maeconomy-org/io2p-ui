'use client'

import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Paperclip,
  Sigma,
} from 'lucide-react'

import { Badge, Button } from '@/components/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * What each mark and toggle on the sheet means, in one place. The samples are drawn with the same
 * classes the rows use, so the legend shows exactly what the reader is looking at.
 */
export function MarksLegend() {
  const t = useTranslations('objects.properties.legend')
  // The marks' own labels, so the legend cannot drift from the rows.
  const mark = useTranslations('objects.properties')
  const rows: { sample: React.ReactNode; text: string }[] = [
    {
      sample: (
        <Badge
          variant="secondary"
          className="h-5 whitespace-nowrap px-1.5 text-[11px]"
        >
          {mark('noUnit')}
        </Badge>
      ),
      text: t('noUnit'),
    },
    {
      sample: (
        <Badge
          variant="outline"
          className="h-5 gap-1 whitespace-nowrap border-amber-500/60 bg-amber-50 px-1.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
        >
          <AlertTriangle className="h-3 w-3" />
          {mark('unitNotCounted')}
        </Badge>
      ),
      text: t('notCounted'),
    },
    {
      sample: (
        <Badge
          variant="outline"
          className="h-5 gap-1 whitespace-nowrap border-destructive/60 bg-destructive/10 px-1.5 text-[11px] text-destructive"
        >
          <AlertTriangle className="h-3 w-3" />
          {mark('formulaError')}
        </Badge>
      ),
      text: t('error'),
    },
    {
      sample: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
      text: t('excluded'),
    },
    {
      sample: (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      ),
      text: t('totalIssue'),
    },
    {
      sample: (
        <span className="flex items-center gap-0.5 text-muted-foreground">
          <Sigma className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </span>
      ),
      text: t('formula'),
    },
    {
      sample: (
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />2
          <ChevronDown className="h-3 w-3" />
        </span>
      ),
      text: t('files'),
    },
  ]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label={t('open')}
          title={t('open')}
          data-testid="marks-legend"
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <dl className="mt-2 grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2.5 text-sm">
          {rows.map((row) => (
            <div key={row.text} className="contents">
              <dt className="flex items-center pt-0.5">{row.sample}</dt>
              <dd className="text-muted-foreground">{row.text}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
