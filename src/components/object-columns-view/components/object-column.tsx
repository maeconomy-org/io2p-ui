'use client'

import { ChevronRight, FileText, MoreHorizontal } from 'lucide-react'
import { hasChildren } from '../utils'
import {
  Button,
  ScrollArea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
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
  searchTerm = '',
  onSearchChange,
  columnTitle = 'Objects',
}: ObjectColumnProps) {
  // Get icon based on object type
  const getIcon = (item: ObjectItem) => {
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
        title={columnTitle}
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
                Loading children...
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div className="text-sm text-muted-foreground">
                {searchTerm
                  ? 'No items match your search'
                  : 'No items in this column'}
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
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="rounded-full w-5 h-5 flex items-center justify-center bg-blue-50 text-blue-600 mr-2 shrink-0">
                      {getIcon(item)}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${isSoftDeleted ? 'text-red-600 line-through' : ''}`}
                        >
                          {item.name || 'Unnamed Object'}
                        </span>
                        {itemHasChildren && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 shrink-0">
                            📁 {item.childCount || item.children?.length || 0}
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
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(item)}
                          className="text-destructive"
                          disabled={isSoftDeleted}
                        >
                          Delete
                        </DropdownMenuItem>
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
