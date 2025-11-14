'use client'

import { useState, useMemo } from 'react'
import { ArrowRight } from 'lucide-react'

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from '@/components/ui'
import { usePagination } from '@/hooks'
import { MaterialRelationship } from '@/types'

interface RelationshipsTableProps {
  relationships: MaterialRelationship[]
  onRelationshipSelect?: (relationship: MaterialRelationship) => void
  selectedRelationship?: MaterialRelationship | null
  className?: string
  pageSize?: number
}

export function RelationshipsTable({
  relationships,
  onRelationshipSelect,
  selectedRelationship,
  className = '',
  pageSize = 10,
}: RelationshipsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const filteredRelationships = useMemo(() => {
    return relationships.filter(
      (rel) =>
        rel.subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.object.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.processName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.unit.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [relationships, searchTerm])

  // Pagination logic
  const paginationInfo = useMemo(() => {
    const totalElements = filteredRelationships.length
    const totalPages = Math.ceil(totalElements / pageSize)
    return {
      currentPage,
      totalPages,
      totalElements,
      pageSize,
      isFirstPage: currentPage === 0,
      isLastPage: currentPage >= totalPages - 1,
    }
  }, [filteredRelationships.length, pageSize, currentPage])

  const paginationHandlers = usePagination({
    pagination: paginationInfo,
    onPageChange: setCurrentPage,
  })

  // Get current page data
  const paginatedRelationships = useMemo(() => {
    const startIndex = currentPage * pageSize
    const endIndex = startIndex + pageSize
    return filteredRelationships.slice(startIndex, endIndex)
  }, [filteredRelationships, currentPage, pageSize])

  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity.toLocaleString()} ${unit}`
  }

  return (
    <div className="flex flex-col">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Input Material</TableHead>
              <TableHead className="text-center w-12"></TableHead>
              <TableHead>Output Material</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRelationships.length === 0 ? (
              <TableRow>
                <TableCell className="text-center py-8 text-muted-foreground">
                  {filteredRelationships.length === 0
                    ? 'No relationships found'
                    : 'No relationships on this page'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRelationships.map((relationship, index) => (
                <TableRow
                  key={`${relationship.subject.uuid}-${relationship.object.uuid}-${relationship.processName}-${relationship.quantity}-${relationship.unit}-${index}`}
                  className={`cursor-pointer transition-colors ${
                    selectedRelationship?.subject.uuid ===
                      relationship.subject.uuid &&
                    selectedRelationship?.object.uuid ===
                      relationship.object.uuid &&
                    selectedRelationship?.processName ===
                      relationship.processName
                      ? 'bg-muted/50 border-l-4 border-l-primary'
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => onRelationshipSelect?.(relationship)}
                >
                  <TableCell>
                    {relationship.processName && (
                      <span className="text-sm font-medium">
                        {relationship.processName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Badge variant="secondary">
                      {formatQuantity(relationship.quantity, relationship.unit)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {relationship.subject.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {relationship.subject.uuid}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {relationship.object.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {relationship.object.uuid}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Table Info and Pagination */}
      {paginationInfo.totalPages > 1 && (
        <TablePagination
          currentPage={paginationInfo.currentPage} // Keep 0-based as expected by component
          totalPages={paginationInfo.totalPages}
          totalElements={paginationInfo.totalElements}
          pageSize={paginationInfo.pageSize}
          onPageChange={(page) => paginationHandlers.handlePageChange(page)} // Keep 0-based
          onFirst={() => paginationHandlers.handleFirst()}
          onPrevious={() => paginationHandlers.handlePrevious()}
          onNext={() => paginationHandlers.handleNext()}
          onLast={() => paginationHandlers.handleLast()}
          isFirstPage={paginationInfo.isFirstPage}
          isLastPage={paginationInfo.isLastPage}
        />
      )}
    </div>
  )
}
