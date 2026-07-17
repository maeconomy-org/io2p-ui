'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ObjectDTO } from 'io2p-client'

import { MillerColumn, type MillerColumnActions } from './components'

function columnTitle(
  index: number,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  return index === 0
    ? t('objects.columnsView.rootObjects')
    : t('objects.columnsView.level', { level: index + 1 })
}

interface ObjectColumnsViewProps extends MillerColumnActions {
  showDeleted?: boolean
  isRestoring?: boolean
}

export function ObjectColumnsView({
  showDeleted = false,
  isRestoring = false,
  ...actions
}: ObjectColumnsViewProps) {
  const t = useTranslations()

  // `openPath` = ids of the expanded parents (each opens a child column);
  // `selected` = the highlighted id per column. Both truncate on a new selection.
  const [openPath, setOpenPath] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const parentIds = ['', ...openPath]

  const handleSelect = (columnIndex: number, item: ObjectDTO) => {
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
              title={columnTitle(index, t)}
              selectedId={selected[index] ?? null}
              showDeleted={showDeleted}
              isRestoring={isRestoring}
              onSelect={(item) => handleSelect(index, item)}
              {...actions}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
