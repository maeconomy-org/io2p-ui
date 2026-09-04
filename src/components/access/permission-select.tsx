'use client'

import { useTranslations } from 'next-intl'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'

/** The permission ladder, weakest first. Each level contains the ones below it. */
export const PERMISSIONS = ['read', 'write', 'share', 'admin'] as const
export type Permission = (typeof PERMISSIONS)[number]

/**
 * A permission is not a role, it is a rung: `read` see · `write` edit · `share` re-grant up to your
 * own level · `admin` manage grants and delete. The description under each option is the whole
 * feature — "write" alone does not tell anyone that it excludes deleting.
 */
export function PermissionSelect({
  value,
  onChange,
  disabled,
  className,
  testId,
  'aria-label': ariaLabel,
}: {
  value: Permission
  onChange: (next: Permission) => void
  disabled?: boolean
  className?: string
  testId?: string
  'aria-label'?: string
}) {
  const t = useTranslations()

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as Permission)}
      disabled={disabled}
    >
      {/* The trigger renders the label ITSELF rather than `<SelectValue />`. Radix mirrors the
          selected item's children into the trigger, and these items are two lines — label over
          hint — which a one-line trigger squashes. The hint belongs where you are choosing, not
          where you are reading back what you chose. */}
      <SelectTrigger
        className={cn('h-9', className)}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <span className="truncate">{t(`access.permission.${value}`)}</span>
      </SelectTrigger>
      <SelectContent>
        {PERMISSIONS.map((permission) => (
          <SelectItem key={permission} value={permission}>
            <span className="flex flex-col items-start">
              <span>{t(`access.permission.${permission}`)}</span>
              <span className="text-xs text-muted-foreground">
                {t(`access.permissionHint.${permission}`)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
