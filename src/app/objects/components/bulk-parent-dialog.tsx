'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Label,
} from '@/components/ui'
import { ObjectPicker } from '@/components/entity-sheet/fields/object-picker'
import { useObjects } from '@/hooks/api/entities'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

/**
 * Move several objects under one parent.
 *
 * The hierarchy is PARENTS-ONLY — there is no children collection to append to, so this PATCHes
 * each selected object's own `parents`, which is the only way the relationship is expressible.
 *
 * Sequential, not `Promise.all`: a partial failure should stop with some objects moved and the rest
 * where they were, rather than scattering an unknown subset.
 */
export function BulkParentDialog({
  open,
  onOpenChange,
  objects,
  skippedCount = 0,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Only the objects the viewer may move — the caller filters the selection. */
  objects: ObjectListItem[]
  /** Selected objects left out because the viewer may not move them. */
  skippedCount?: number
  onDone: () => void
}) {
  const t = useTranslations()
  const [parentId, setParentId] = useState('')
  const [parentName, setParentName] = useState('')
  const [saving, setSaving] = useState(false)

  const updateMutation = useObjects().useUpdate()

  // Moving an object under itself would make it its own ancestor; the node rejects it, but the
  // option should not be offered in the first place.
  const selectedIds = new Set(objects.map((o) => o.id))
  // The only selected object is the chosen parent: nothing would move.
  const nothingToMove = objects.every((o) => o.id === parentId)

  const apply = async () => {
    if (!parentId) return
    setSaving(true)
    try {
      let moved = 0
      for (const object of objects) {
        if (object.id === parentId) continue
        await updateMutation.mutateAsync({
          id: object.id,
          body: { parents: { add: [parentId] } },
        })
        moved += 1
      }
      toast.success(t('objects.bulk.parentSet', { count: moved }))
      onDone()
      onOpenChange(false)
    } catch (error) {
      logger.error('Bulk set parent failed', { err: error })
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('objects.bulk.setParentTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('objects.bulk.setParentDescription', { count: objects.length })}
          </AlertDialogDescription>
          {skippedCount > 0 && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="bulk-parent-skips-unmovable"
            >
              {t('objects.bulk.parentSkipsUnmovable', { count: skippedCount })}
            </p>
          )}
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label>{t('objects.fields.parent')}</Label>
          <ObjectPicker
            testId="bulk-parent-picker"
            requireLinkable
            value={parentId}
            displayName={parentName}
            className="w-full"
            onSelect={(id, name) => {
              setParentId(id)
              setParentName(name)
            }}
          />
          {selectedIds.has(parentId) && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="bulk-parent-skips-self"
            >
              {t('objects.bulk.parentSkipsSelf')}
            </p>
          )}
        </div>

        <AlertDialogFooter className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!parentId || nothingToMove || saving}
            onClick={apply}
            data-testid="bulk-parent-save"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
