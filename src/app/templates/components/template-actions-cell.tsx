'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { TemplateDTO } from 'io2p-client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'

export interface TemplateRowActions {
  onViewDetails: (template: TemplateDTO) => void
  onEdit: (template: TemplateDTO) => void
  onDelete: (template: TemplateDTO) => void
  onRestore: (template: TemplateDTO) => void
}

/**
 * Row actions for the templates table, matching the objects table: a primary Details button with the
 * rest behind a dropdown.
 *
 * System templates are owned by the node, so they open read-only — the write actions are omitted
 * rather than shown disabled, since the server would reject them with a 403 anyway.
 */
export const TemplateActionsCell = memo(function TemplateActionsCell({
  template,
  actions,
}: {
  template: TemplateDTO
  actions: TemplateRowActions
}) {
  const t = useTranslations()
  const isDeleted = !!template.deleted
  const canWrite = !template.system

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center rounded-md border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-r-none border-r px-2.5 text-xs"
          onClick={stop(() => actions.onViewDetails(template))}
          data-testid="template-details-button"
        >
          {t('objects.viewDetails')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              aria-label={t('common.actions')}
              onClick={(e) => e.stopPropagation()}
              data-testid="template-actions-dropdown"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canWrite && !isDeleted && (
              <DropdownMenuItem onClick={stop(() => actions.onEdit(template))}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </DropdownMenuItem>
            )}
            {canWrite && (
              <>
                {!isDeleted && <DropdownMenuSeparator />}
                {isDeleted ? (
                  <DropdownMenuItem
                    onClick={stop(() => actions.onRestore(template))}
                  >
                    <RotateCcw className="mr-2 h-4 w-4 text-blue-600" />
                    {t('common.restore')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={stop(() => actions.onDelete(template))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                )}
              </>
            )}
            {!canWrite && (
              <DropdownMenuItem disabled>
                {t('templates.systemReadOnly')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})
