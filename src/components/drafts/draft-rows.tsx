'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'

import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { formatTimestamp } from '@/components/entity-list/columns'
import { EntityActionsCell } from '@/components/entity-list/entity-actions-cell'
import { TableCell, TableRow } from '@/components/ui'
import type { DraftIndexEntry } from '@/hooks/drafts'

import { DraftBadge } from './draft-badge'

interface DraftRowsProps {
  drafts: DraftIndexEntry[]
  /** Current visible column count, from `DataTable.pinnedRows`. */
  colSpan: number
  onResume: (id: string) => void
  onDiscard: (id: string) => void
}

/**
 * Locally-saved drafts, pinned above the server page.
 *
 * These are NOT rows in TanStack's model — see `DataTable.pinnedRows`. They carry no server id, so
 * they are deliberately unselectable: a bulk delete or share that swept one up would send the API
 * an id it has never issued.
 *
 * One spanning cell rather than a cell per column, because a draft has none of the columns' data —
 * no owner, no created date, no child count. Empty cells would imply those values exist and are
 * blank, and the layout would also break the moment the column toggle hides one.
 */
export function DraftRows({
  drafts,
  colSpan,
  onResume,
  onDiscard,
}: DraftRowsProps) {
  const t = useTranslations()
  const [discarding, setDiscarding] = useState<DraftIndexEntry | null>(null)

  if (drafts.length === 0) return null

  return (
    <>
      {drafts.map((draft) => (
        <TableRow
          key={draft.id}
          data-testid="draft-row"
          className="cursor-pointer border-l-2 border-l-primary/40 bg-muted/40 hover:bg-muted/60"
          onDoubleClick={() => onResume(draft.id)}
        >
          <TableCell colSpan={colSpan}>
            <div className="flex items-center gap-3">
              <DraftBadge className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {draft.name || t('objects.drafts.untitled')}
              </span>
              <span className="text-muted-foreground shrink-0 text-sm">
                {t('objects.drafts.savedOn', {
                  date: formatTimestamp(draft.updatedAt),
                })}
              </span>
              <EntityActionsCell
                testIdPrefix="draft"
                onViewDetails={() => onResume(draft.id)}
                detailsLabel={t('objects.drafts.actions.resume')}
                actions={[
                  {
                    key: 'discard',
                    label: t('objects.drafts.actions.discard'),
                    icon: Trash2,
                    destructive: true,
                    onSelect: () => setDiscarding(draft),
                  },
                ]}
              />
            </div>
          </TableCell>
        </TableRow>
      ))}

      <DeleteConfirmationDialog
        open={!!discarding}
        onOpenChange={(open) => !open && setDiscarding(null)}
        objectName={discarding?.name ?? ''}
        title={t('objects.drafts.discardConfirm.title')}
        description={t('objects.drafts.discardConfirm.description')}
        confirmLabel={t('objects.drafts.discardConfirm.confirm')}
        onDelete={() => {
          if (discarding) onDiscard(discarding.id)
          setDiscarding(null)
        }}
      />
    </>
  )
}
