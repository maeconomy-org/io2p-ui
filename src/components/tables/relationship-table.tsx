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
import { EnhancedMaterialRelationship, FlowCategory, QualityChangeCode } from '@/types/sankey-metadata'

interface RelationshipsTableProps {
  relationships: EnhancedMaterialRelationship[]
  onRelationshipSelect?: (relationship: EnhancedMaterialRelationship) => void
  selectedRelationship?: EnhancedMaterialRelationship | null
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
        rel.inputMaterial?.unit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.outputMaterial?.unit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const formatQuantity = (relationship: EnhancedMaterialRelationship) => {
    // Use input material quantity/unit from the new structure
    const quantity = relationship.inputMaterial?.quantity || relationship.quantity
    const unit = relationship.inputMaterial?.unit || relationship.unit
    
    if (quantity && unit) {
      return `${quantity.toLocaleString()} ${unit}`
    }
    return 'Not specified'
  }

  // Helper to get text for quality change
  const getQualityChangeText = (code?: QualityChangeCode) => {
    switch (code) {
      case 'UP':
        return 'UPCYCLED'
      case 'SAME':
        return 'SAME'
      case 'DOWN':
        return 'DOWNCYCLED'
      default:
        return ''
    }
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
              <TableHead className="text-center">Flow</TableHead>
              <TableHead className="text-right">Emissions</TableHead>
              <TableHead className="text-right">Loss %</TableHead>
              <TableHead className="text-center">Quality</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRelationships.length === 0 ? (
              <TableRow>
                <TableCell className="text-center py-8 text-muted-foreground" {...{ colSpan: 9 }}>
                  {filteredRelationships.length === 0
                    ? 'No relationships found'
                    : 'No relationships on this page'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRelationships.map((relationship, index) => (
                <TableRow
                  key={`${relationship.subject.uuid}-${relationship.object.uuid}-${relationship.processName}-${relationship.inputMaterial?.quantity || 0}-${relationship.inputMaterial?.unit || ''}-${index}`}
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
                      {formatQuantity(relationship)}
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
                  
                  <TableCell className="text-center">
                    {relationship.flowCategory && (
                      <Badge variant="secondary" className="text-xs">
                        {relationship.flowCategory.replace('_', ' ')}
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {relationship.emissionsTotal !== undefined ? (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                        {relationship.emissionsTotal} {relationship.emissionsUnit || 'kgCO2e'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {relationship.materialLossPercent !== undefined ? (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        {relationship.materialLossPercent}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {relationship.qualityChangeCode ? (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {getQualityChangeText(relationship.qualityChangeCode)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
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
