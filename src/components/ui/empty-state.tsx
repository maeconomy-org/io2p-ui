import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Icon displayed above the title */
  icon?: ReactNode
  /** Primary heading */
  title: string
  /** Secondary description text */
  description?: string
  /** Optional action button or link */
  action?: ReactNode
  /** Additional class names for the wrapper */
  className?: string
}

/**
 * Reusable empty-state placeholder for lists, sections, and pages.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={<Inbox className="h-10 w-10" />}
 *   title={t('objects.noObjectsTitle')}
 *   description={t('objects.noObjectsDescription')}
 *   action={<Button onClick={onCreate}>{t('objects.create')}</Button>}
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
      data-testid="empty-state"
    >
      {icon && <div className="mb-4 text-muted-foreground/60">{icon}</div>}
      <h3 className="text-lg font-medium">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
