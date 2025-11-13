'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, ArrowRight, Loader2 } from 'lucide-react'
import {
  Button,
  EditableSection,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Separator,
} from '@/components/ui'
import { useObjectProcesses } from '@/hooks'
import { ParentDisplay } from '../components/ParentDisplay'
import { ParentSelector } from '../components/ParentSelector'

interface RelationshipsTabProps {
  object: any
  isDeleted?: boolean
  parents: any[]
  setParents: (parents: any[]) => void
  activeEditingSection: string | null
  setActiveEditingSection: (section: string | null) => void
  onSaveParents: () => Promise<void>
}

export function RelationshipsTab({
  object,
  isDeleted,
  parents,
  setParents,
  activeEditingSection,
  setActiveEditingSection,
  onSaveParents,
}: RelationshipsTabProps) {
  const router = useRouter()

  // Lightweight hook specifically designed for object processes
  const { createdBy, usedIn, isLoading } = useObjectProcesses({
    objectUuid: object?.uuid,
  })

  // Derived states for editing modes
  const isParentsEditing = activeEditingSection === 'parents'

  // Handle section edit toggling
  const handleEditToggle = (section: string, isEditing: boolean) => {
    if (isEditing) {
      setActiveEditingSection(section)
    } else {
      if (activeEditingSection === section) {
        setActiveEditingSection(null)
      }
    }
  }

  // Apply 20-item limit and check if we need "View More" button
  const limitedRelationships = useMemo(() => {
    const LIMIT = 20
    const totalCreatedBy = createdBy.length
    const totalUsedIn = usedIn.length
    const totalRelationships = totalCreatedBy + totalUsedIn

    return {
      createdBy: createdBy.slice(0, LIMIT),
      usedIn: usedIn.slice(0, Math.max(0, LIMIT - createdBy.length)),
      hasMore: totalRelationships > LIMIT,
      totalCount: totalRelationships,
      shownCount: Math.min(totalRelationships, LIMIT),
    }
  }, [createdBy, usedIn])

  // Handle redirect to processes page with object filter
  const handleViewProcesses = () => {
    router.push(`/processes?objectUuid=${object.uuid}`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="pt-4 space-y-6">
      {/* Parent Objects Section */}
      <EditableSection
        title="Parent Objects"
        isEditing={isParentsEditing}
        onEditToggle={(isEditing) => handleEditToggle('parents', isEditing)}
        onSave={onSaveParents}
        successMessage="Parent objects updated successfully"
        showToast={false}
        renderDisplay={() => (
          <div>
            {parents && parents.length > 0 ? (
              <ParentDisplay parents={parents} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No parent objects assigned
              </p>
            )}
          </div>
        )}
        renderEdit={() => (
          <div className="space-y-4">
            <ParentSelector
              selectedParents={parents}
              onParentsChange={setParents}
              placeholder="Search for parent objects..."
              maxSelections={50}
              currentObjectUuid={object?.uuid}
            />
          </div>
        )}
      />

      <Separator />

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Input/Output Relationships
        </h3>
        {!isDeleted && limitedRelationships.totalCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleViewProcesses}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            {limitedRelationships.hasMore
              ? 'View All in Processes'
              : 'View in Processes'}
          </Button>
        )}
      </div>

      {limitedRelationships.totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-4">
          <h4 className="text-md font-semibold mb-2">
            No Input/Output Processes
          </h4>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Created By Section */}
          {limitedRelationships.createdBy.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Input ({limitedRelationships.createdBy.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Process Name</TableHead>
                    <TableHead>Flow</TableHead>
                    <TableHead>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limitedRelationships.createdBy.map((rel, index) => (
                    <TableRow key={`created-${index}`}>
                      <TableCell className="font-medium">
                        {rel.processName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{rel.inputObjectName}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {object.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rel.quantity > 0
                          ? `${rel.quantity.toLocaleString()} ${rel.unit}`
                          : 'Not specified'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Used In Section */}
          {limitedRelationships.usedIn.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Output ({limitedRelationships.usedIn.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Process Name</TableHead>
                    <TableHead>Flow</TableHead>
                    <TableHead>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limitedRelationships.usedIn.map((rel, index) => (
                    <TableRow key={`used-${index}`}>
                      <TableCell className="font-medium">
                        {rel.processName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {object.name}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {rel.outputObjectName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rel.quantity > 0
                          ? `${rel.quantity.toLocaleString()} ${rel.unit}`
                          : 'Not specified'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
