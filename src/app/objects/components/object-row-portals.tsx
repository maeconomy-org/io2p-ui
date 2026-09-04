'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

import { DeleteConfirmationDialog } from '@/components/dialogs'

import type { ObjectListPageState } from './use-object-list-page'

const EntitySheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.EntitySheet),
  { ssr: false }
)
const DuplicateObjectsSheet = dynamic(
  () =>
    import('@/app/objects/components/duplicate-objects/duplicate-objects-sheet').then(
      (mod) => mod.DuplicateObjectsSheet
    ),
  { ssr: false }
)
const QRCodeDialog = dynamic(
  () =>
    import('@/components/dialogs/qr-code-dialog').then(
      (mod) => mod.QRCodeDialog
    ),
  { ssr: false }
)
const TemplateCreationDialog = dynamic(
  () =>
    import('@/components/dialogs').then((mod) => mod.TemplateCreationDialog),
  { ssr: false }
)
const BulkParentDialog = dynamic(
  () => import('./bulk-parent-dialog').then((mod) => mod.BulkParentDialog),
  { ssr: false }
)
const DeleteObjectDialog = dynamic(
  () => import('./delete-object-dialog').then((mod) => mod.DeleteObjectDialog),
  { ssr: false }
)
const ShareEditorSheet = dynamic(
  () =>
    import('@/app/shares/components/share-editor-sheet').then(
      (mod) => mod.ShareEditorSheet
    ),
  { ssr: false }
)

/**
 * The overlays both object lists open from a row or from the selection: details, QR,
 * duplicate, create-template, delete confirms, set-parent and bundle-share.
 *
 * Every one is `dynamic(..., { ssr: false })` and gated on its own state, so nothing here is in the
 * page's initial bundle — the chunk arrives when the user opens the thing.
 *
 * NOT here, because they differ: the CREATE sheet (the root list resumes a draft, the children page
 * presets a parent), single-object share (root only) and duplicate-into-this-parent (children only).
 */
export function ObjectRowPortals({ state }: { state: ObjectListPageState }) {
  const t = useTranslations()

  return (
    <>
      {state.isDetailsOpen && (
        <EntitySheet
          open={state.isDetailsOpen}
          onOpenChange={state.setIsDetailsOpen}
          entityId={state.selectedObject?.id}
        />
      )}

      {state.qrTarget && (
        <QRCodeDialog
          isOpen
          onClose={() => state.setQrTarget(null)}
          uuid={state.qrTarget.id}
          objectName={state.qrTarget.name}
        />
      )}

      {state.duplicateTarget && (
        <DuplicateObjectsSheet
          open
          onOpenChange={(open) => !open && state.setDuplicateTarget(null)}
          preselectedObjects={[
            {
              uuid: state.duplicateTarget.id,
              name: state.duplicateTarget.name ?? '',
              childCount: state.duplicateTarget.childCount ?? 0,
            },
          ]}
        />
      )}

      {state.templateFromObject.source && (
        <TemplateCreationDialog
          open
          onOpenChange={(open) =>
            !open && state.templateFromObject.setSource(null)
          }
          initialData={state.templateFromObject.initialData}
          onConfirm={state.templateFromObject.confirm}
          isCreating={state.templateFromObject.isCreating}
        />
      )}

      <BulkParentDialog
        open={state.bulkParentOpen}
        onOpenChange={state.setBulkParentOpen}
        objects={state.selectedObjects}
        onDone={state.clearSelection}
      />

      {/* Bundling a selection is exactly what a Share IS, so the editor opens seeded with it and
          the user can add more before saving. */}
      {state.shareBundleOpen && (
        <ShareEditorSheet
          open
          onOpenChange={(open) => !open && state.setShareBundleOpen(false)}
          mode="create"
          seedResources={state.shareableObjects.map((o) => ({
            type: 'object' as const,
            id: o.id,
            name: o.name,
          }))}
        />
      )}

      {state.objectToDelete && (
        <DeleteObjectDialog
          object={state.objectToDelete}
          onOpenChange={(open) => !open && state.setObjectToDelete(null)}
          onDelete={state.confirmDelete}
        />
      )}

      {state.confirmBulkDelete && (
        <DeleteConfirmationDialog
          open
          onOpenChange={(open) => !open && state.setConfirmBulkDelete(false)}
          objectName={`${state.selectedIds.length} ${t('objects.title')}`}
          onDelete={state.runBulkDelete}
        />
      )}
    </>
  )
}
