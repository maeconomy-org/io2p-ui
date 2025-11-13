'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button, Input, ColumnPagination } from '@/components/ui'

interface ColumnHeaderProps {
  title: string
  searchTerm: string
  onSearchChange: (term: string) => void
  itemCount: number
  pagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
  }
  isLoading?: boolean
}

export function ColumnHeader({
  title,
  searchTerm,
  onSearchChange,
  itemCount,
  pagination,
  isLoading = false,
}: ColumnHeaderProps) {
  const clearSearch = () => {
    onSearchChange('')
  }

  return (
    <div className="border-b bg-muted/20">
      <div className="p-2">
        {/* Title and Count */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="text-xs text-muted-foreground">
            {pagination
              ? searchTerm
                ? `${itemCount} of ${pagination.totalItems} items`
                : `${itemCount} of ${pagination.totalItems} items`
              : `${itemCount} items`}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search in column..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Compact Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pb-2">
          <ColumnPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            onPageChange={pagination.onPageChange}
            loading={isLoading}
          />
        </div>
      )}
    </div>
  )
}
