'use client'

import { useTranslations } from 'next-intl'
import { FolderTree, Share2 } from 'lucide-react'

import { BulkActionBar } from '@/components/entity-list'

import type { ObjectListPageState } from './use-object-list-page'

/**
 * The selection bar both object lists show. Set parent is offered on the children page too — the
 * hierarchy is a DAG, so a child can gain another parent without leaving this one.
 */
export function ObjectBulkBar({
  state,
  /** The root list zeroes this in column view, where there is no row selection to act on. */
  count = state.selectedObjects.length,
}: {
  state: ObjectListPageState
  count?: number
}) {
  const t = useTranslations()

  return (
    <BulkActionBar
      count={count}
      onClear={state.clearSelection}
      canDelete={state.canDeleteSelection}
      canRestore={state.anySelectedDeleted}
      busy={state.isBusy}
      onDelete={() => state.setConfirmBulkDelete(true)}
      onRestore={state.runBulkRestore}
      actions={[
        {
          key: 'share',
          label: t('access.share'),
          icon: Share2,
          // A bundle needs `share` on EVERY resource or the node refuses the whole call.
          hidden: state.shareableObjects.length === 0,
          actionable: state.shareableObjects.length,
          onSelect: () => state.setShareBundleOpen(true),
        },
        {
          key: 'set-parent',
          label: t('objects.bulk.setParent'),
          icon: FolderTree,
          onSelect: () => state.setBulkParentOpen(true),
        },
      ]}
    />
  )
}
