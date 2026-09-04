'use client'

import { useTranslations } from 'next-intl'
import { RotateCcw, Trash2, X, type LucideIcon } from 'lucide-react'

export interface BulkAction {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  disabled?: boolean
  /**
   * Drop the button entirely. Prefer this to `disabled` for anything the viewer may not do — a
   * greyed control still claims the feature exists and gives no reason.
   */
  hidden?: boolean
  /**
   * How many of the selected rows this action will actually touch, when that is fewer than all of
   * them. Rendered beside the label so a partial run is visible BEFORE it happens, rather than
   * discovered from a count in the toast afterwards.
   */
  actionable?: number
}

import {
  Button,
  FloatingActionBar,
  FloatingActionBarSeparator,
} from '@/components/ui'

/**
 * The selection bar every list shares.
 *
 * FLOATING rather than inline: a bar that appears in the flow pushes the table down at the exact
 * moment the user is clicking checkboxes on it, moving the rows they were aiming at. (`/objects`
 * still has an inline one — it predates this and is worth converting.)
 *
 * Delete and Restore are offered together rather than switched between, because a selection can
 * span both states: five rows where two are already deleted has no single correct verb. Each button
 * hides when nothing in the selection can take it.
 */
export function BulkActionBar({
  count,
  onClear,
  onDelete,
  onRestore,
  canDelete = true,
  canRestore = false,
  busy,
  deleteLabel,
  deleteIcon: DeleteIcon = Trash2,
  actions = [],
}: {
  count: number
  onClear: () => void
  onDelete?: () => void
  onRestore?: () => void
  /** False when every selected row is already deleted. */
  canDelete?: boolean
  /** True when at least one selected row is deleted. */
  canRestore?: boolean
  busy?: boolean
  /** Override where the destructive slot is the same but the verb is not — e.g. "Revoke all". */
  deleteLabel?: string
  deleteIcon?: LucideIcon
  /** Non-destructive actions, rendered before Restore/Delete. */
  actions?: BulkAction[]
}) {
  const t = useTranslations()

  return (
    <FloatingActionBar
      open={count > 0}
      label={t('common.bulk.label')}
      data-testid="bulk-bar"
    >
      <span className="px-2 text-sm font-medium" data-testid="bulk-count">
        {t('common.bulk.selected', { count })}
      </span>
      <FloatingActionBarSeparator />

      {actions
        .filter((action) => !action.hidden)
        .map((action) => (
          <Button
            key={action.key}
            type="button"
            data-testid={`bulk-${action.key}`}
            variant="ghost"
            size="sm"
            className="whitespace-nowrap rounded-full"
            disabled={busy || action.disabled}
            onClick={action.onSelect}
          >
            <action.icon className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">
              {action.actionable !== undefined && action.actionable < count
                ? t('common.bulk.partial', {
                    label: action.label,
                    count: action.actionable,
                    total: count,
                  })
                : action.label}
            </span>
          </Button>
        ))}

      {onRestore && canRestore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="whitespace-nowrap rounded-full"
          data-testid="bulk-restore"
          disabled={busy}
          onClick={onRestore}
        >
          <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{t('common.restore')}</span>
        </Button>
      )}

      {onDelete && canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="whitespace-nowrap rounded-full text-destructive hover:text-destructive"
          data-testid="bulk-delete"
          disabled={busy}
          onClick={onDelete}
        >
          <DeleteIcon className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">
            {deleteLabel ?? t('common.delete')}
          </span>
        </Button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="whitespace-nowrap rounded-full"
        aria-label={t('common.clearSelection')}
        data-testid="bulk-clear"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </FloatingActionBar>
  )
}
