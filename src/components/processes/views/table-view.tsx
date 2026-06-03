'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
import {
  EnhancedMaterialRelationship,
  MaterialData,
} from '@/types/sankey-metadata'

interface ProcessTableViewProps {
  relationships: EnhancedMaterialRelationship[]
  onRelationshipSelect?: (relationship: EnhancedMaterialRelationship) => void
  selectedRelationship?: EnhancedMaterialRelationship | null
  pageSize?: number
}

export function ProcessTableView({
  relationships,
  onRelationshipSelect,
  selectedRelationship,
  pageSize = 10,
}: ProcessTableViewProps) {
  const t = useTranslations('processTable')
  const [searchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const filteredRelationships = useMemo(() => {
    return relationships.filter(
      (rel) =>
        rel.subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.object.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.processName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.inputMaterial?.unit
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        rel.outputMaterial?.unit
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        rel.processTypeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.flowCategory?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.notes?.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Raw value as entered ("0.1 t"), with a fallback for legacy quantity/unit.
  const displayQuantity = (material?: MaterialData) => {
    if (material?.displayValue) return material.displayValue
    if (material?.quantity) {
      return `${material.quantity.toLocaleString()} ${material.unit ?? ''}`.trim()
    }
    return null
  }

  return (
    <div className="flex flex-col">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('process')}</TableHead>
              <TableHead>{t('inputMaterial')}</TableHead>
              <TableHead className="text-center w-12"></TableHead>
              <TableHead>{t('outputMaterial')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRelationships.length === 0 ? (
              <TableRow>
                <TableCell
                  className="text-center py-8 text-muted-foreground"
                  {...{ colSpan: 4 }}
                >
                  {filteredRelationships.length === 0
                    ? t('noRelationshipsFound')
                    : t('noRelationshipsOnPage')}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRelationships.map((relationship) => {
                const inQty = displayQuantity(relationship.inputMaterial)
                const outQty = displayQuantity(relationship.outputMaterial)
                return (
                  <TableRow
                    key={`${relationship.subject.uuid}-${relationship.object.uuid}-${relationship.processName}-${relationship.inputMaterial?.displayValue || ''}`}
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
                    <TableCell>
                      <div className="font-medium">
                        {relationship.subject.name}
                      </div>
                      {inQty && (
                        <Badge variant="secondary" className="mt-1 font-mono">
                          {inQty}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {relationship.object.name}
                      </div>
                      {outQty && (
                        <Badge variant="secondary" className="mt-1 font-mono">
                          {outQty}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
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
