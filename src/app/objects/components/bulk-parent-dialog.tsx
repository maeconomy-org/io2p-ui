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
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  objects: ObjectListItem[]
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

  const apply = async () => {
    if (!parentId) return
    setSaving(true)
    try {
      for (const object of objects) {
        if (object.id === parentId) continue
        await updateMutation.mutateAsync({
          id: object.id,
          body: { parents: { add: [parentId] } },
        })
      }
      toast.success(t('objects.bulk.parentSet', { count: objects.length }))
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
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label>{t('objects.fields.parent')}</Label>
          <ObjectPicker
            testId="bulk-parent-picker"
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
            disabled={!parentId || saving}
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
