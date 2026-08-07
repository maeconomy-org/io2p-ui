'use client'

import { memo, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, type LucideIcon } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'

export interface EntityRowAction {
  /** Stable key; also the `data-testid` suffix. */
  key: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  /** Renders in the destructive colour — delete and nothing else. */
  destructive?: boolean
  disabled?: boolean
  /** Draws a separator ABOVE this item. */
  separated?: boolean
}

/**
 * The row actions every entity table shares: a primary Details button, with everything else behind a
 * dropdown.
 *
 * Objects, templates and processes had (or were about to have) three copies of this — same markup,
 * same stopPropagation dance, drifting independently. The actions themselves differ per entity, so
 * they arrive as a list rather than as a fixed prop per verb.
 *
 * Every handler stops propagation: these cells sit inside rows that open the entity on click, and a
 * menu item that also triggered the row would fire two things at once.
 */
export const EntityActionsCell = memo(function EntityActionsCell({
  onViewDetails,
  actions,
  detailsLabel,
  testIdPrefix = 'entity',
  emptyMenuLabel,
}: {
  onViewDetails: () => void
  actions: EntityRowAction[]
  /** Defaults to the shared "View details" wording. */
  detailsLabel?: string
  testIdPrefix?: string
  /** Shown disabled when there are no actions — e.g. a read-only system template. */
  emptyMenuLabel?: string
}) {
  const t = useTranslations()

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  // Nothing to put in the menu and nothing to say about why — drop the trigger rather than open an
  // empty dropdown. This is the read-only case (a viewer, a system-owned row).
  const hasMenu = actions.length > 0 || !!emptyMenuLabel

  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center rounded-md border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs',
            hasMenu && 'rounded-r-none border-r'
          )}
          onClick={stop(onViewDetails)}
          data-testid={`${testIdPrefix}-details-button`}
        >
          {detailsLabel ?? t('objects.viewDetails')}
        </Button>
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-l-none"
                aria-label={t('common.actions')}
                onClick={(e) => e.stopPropagation()}
                data-testid={`${testIdPrefix}-actions-dropdown`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.length === 0 && emptyMenuLabel && (
                <DropdownMenuItem disabled>{emptyMenuLabel}</DropdownMenuItem>
              )}
              {actions.map((action) => (
                <ActionItem
                  key={action.key}
                  action={action}
                  testIdPrefix={testIdPrefix}
                  onSelect={stop(action.onSelect)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
})

function ActionItem({
  action,
  testIdPrefix,
  onSelect,
}: {
  action: EntityRowAction
  testIdPrefix: string
  onSelect: (e: MouseEvent) => void
}) {
  const Icon = action.icon
  return (
    <>
      {action.separated && <DropdownMenuSeparator />}
      <DropdownMenuItem
        disabled={action.disabled}
        onClick={onSelect}
        className={
          action.destructive ? 'text-destructive focus:text-destructive' : ''
        }
        data-testid={`${testIdPrefix}-action-${action.key}`}
      >
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {action.label}
      </DropdownMenuItem>
    </>
  )
}
