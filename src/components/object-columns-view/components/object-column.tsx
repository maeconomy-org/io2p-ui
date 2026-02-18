'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ChevronRight,
  Copy,
  FileText,
  MoreHorizontal,
  QrCode,
  Trash2,
} from 'lucide-react'
import {
  Button,
  ScrollArea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { truncateText } from '@/lib'
import { hasChildren } from '../utils'
import { ColumnHeader } from './column-header'

// Define interfaces for our data
interface Property {
  uuid: string
  key: string
  value?: string
  values?: { value: string }[]
}

interface ObjectItem {
  uuid: string
  name: string
  modelUuid?: string
  modelName?: string
  modelVersion?: string
  properties?: Property[]
  children?: ObjectItem[]
  hasChildren?: boolean
  childCount?: number
  createdAt: string
  updatedAt: string
  files?: any[]
  softDeleted?: boolean
  softDeletedAt?: string
  softDeleteBy?: string
  description?: string
}

interface ObjectColumnProps {
  items: ObjectItem[]
  selectedId: string | null
  isLoading?: boolean
  pagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
  }
  onSelect: (item: ObjectItem) => void
  onShowDetails: (item: ObjectItem) => void
  onDelete: (item: ObjectItem) => void
  onDuplicate?: (item: ObjectItem) => void
  onShowQRCode?: (item: ObjectItem) => void
  searchTerm?: string
  onSearchChange?: (search: string) => void
  columnTitle?: string
}

export function ObjectColumn({
  items,
  selectedId,
  isLoading = false,
  pagination,
  onSelect,
  onShowDetails,
  onDelete,
  onDuplicate,
  onShowQRCode,
  searchTerm = '',
  onSearchChange,
  columnTitle,
}: ObjectColumnProps) {
  const t = useTranslations()
  const title = columnTitle ?? t('objects.title')
  // Get icon based on object type
  const getIcon = () => {
    return <FileText size={16} />
  }

  // For server-side search, we'll filter on the server
  // For now, keep client-side filtering until server-side search is implemented
  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      item.name?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.uuid?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="flex-1 min-w-[250px] max-w-[300px] h-full border-r overflow-hidden flex flex-col">
      {/* Column Header with Search & Pagination */}
      <ColumnHeader
        title={title}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange || (() => {})}
        itemCount={filteredItems.length}
        pagination={pagination}
        isLoading={isLoading}
      />

      <ScrollArea className="flex-1">
        <div className="px-1 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2"></div>
              <span className="text-sm text-muted-foreground">
                {t('objects.loadingChildren')}
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div className="text-sm text-muted-foreground">
                {searchTerm
                  ? t('objects.noItemsMatch')
                  : t('objects.noItemsColumn')}
              </div>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.uuid === selectedId
              const itemHasChildren = hasChildren(item)
              const isSoftDeleted =
                Boolean(item.softDeleted) || Boolean(item.softDeletedAt)

              return (
                <div
                  key={item.uuid}
                  className={`
                  flex items-center justify-between p-2 rounded-md cursor-pointer mb-1
                  ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                  ${isSoftDeleted ? 'bg-red-50 border border-red-200' : ''}
                `}
                  onClick={() => onSelect(item)}
                  onDoubleClick={() => onShowDetails(item)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium select-none truncate ${isSoftDeleted ? 'text-red-600 line-through' : ''}`}
                        >
                          {truncateText(
                            item.name || t('objects.unnamed'),
                            25,
                            true
                          )}
                        </span>
                        {itemHasChildren && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 shrink-0">
                            {item.childCount || item.children?.length || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onShowDetails(item)}>
                          <FileText className="h-4 w-4 mr-2" />
                          {t('objects.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(item.uuid)
                            toast.success(
                              t('copyButton.copiedWithLabel', { label: 'UUID' })
                            )
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('objects.actions.copyUuid')}
                        </DropdownMenuItem>
                        {onShowQRCode && (
                          <DropdownMenuItem onClick={() => onShowQRCode(item)}>
                            <QrCode className="h-4 w-4 mr-2" />
                            {t('objects.actions.showQrCode')}
                          </DropdownMenuItem>
                        )}
                        {onDuplicate && !isSoftDeleted && (
                          <DropdownMenuItem onClick={() => onDuplicate(item)}>
                            <Copy className="h-4 w-4 mr-2" />
                            {t('objects.duplicate.action')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {!isSoftDeleted && (
                          <DropdownMenuItem
                            onClick={() => onDelete(item)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {itemHasChildren && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
