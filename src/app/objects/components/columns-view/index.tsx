'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ObjectListItem } from 'io2p-client'

import { MillerColumn, type MillerColumnActions } from './components'

function columnTitle(
  index: number,
  t: (key: string, values?: Record<string, string | number>) => string,
  rootLabel?: string
): string {
  if (index > 0) return t('objects.columnsView.level', { level: index + 1 })
  // Rooted at an object, the first column is that object's children — calling
  // it "All objects" would name it after a set it is not.
  return rootLabel ?? t('objects.columnsView.allObjects')
}

interface ObjectColumnsViewProps extends MillerColumnActions {
  showDeleted?: boolean
  isRestoring?: boolean
  /**
   * The access slice, threaded from the page. WITHOUT it the node defaults to `mine`, so switching
   * from the table to this view silently dropped every shared and public object — the same objects,
   * two different answers, with nothing on screen to explain the gap.
   */
  scope?: 'mine' | 'shared' | 'public' | 'all'
  /**
   * Start the first column at this object's children instead of the roots.
   * `''` is the node's roots-only sentinel, so seeding the path is the whole
   * change — every column below already takes its own `parentId`.
   */
  rootId?: string
  /** Names the first column when `rootId` is set. */
  rootLabel?: string
}

export function ObjectColumnsView({
  showDeleted = false,
  isRestoring = false,
  scope = 'all',
  rootId = '',
  rootLabel,
  ...actions
}: ObjectColumnsViewProps) {
  const t = useTranslations()

  // `openPath` = ids of the expanded parents (each opens a child column);
  // `selected` = the highlighted id per column. Both truncate on a new selection.
  const [openPath, setOpenPath] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])

  // Navigating to another object must not keep columns opened under the last
  // one: they would render as that object's descendants and look plausible.
  const [pathRoot, setPathRoot] = useState(rootId)
  if (pathRoot !== rootId) {
    setPathRoot(rootId)
    setOpenPath([])
    setSelected([])
  }

  const parentIds = [rootId, ...openPath]

  const handleSelect = (columnIndex: number, item: ObjectListItem) => {
    setSelected((prev) => [...prev.slice(0, columnIndex), item.id])
    const hasChildren = (item.childCount ?? 0) > 0
    setOpenPath((prev) =>
      hasChildren
        ? [...prev.slice(0, columnIndex), item.id]
        : prev.slice(0, columnIndex)
    )
  }

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col">
      <div className="flex-1 overflow-hidden rounded-md border">
        <div className="flex h-full overflow-x-auto">
          {parentIds.map((parentId, index) => (
            <MillerColumn
              key={`${index}-${parentId}`}
              parentId={parentId}
              title={columnTitle(index, t, rootLabel)}
              selectedId={selected[index] ?? null}
              showDeleted={showDeleted}
              isRestoring={isRestoring}
              scope={scope}
              onSelect={(item) => handleSelect(index, item)}
              {...actions}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
