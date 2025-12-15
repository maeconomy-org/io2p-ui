'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PlusCircle, Loader2, Filter } from 'lucide-react'
import { toast } from 'sonner'

import { EnhancedMaterialRelationship } from '@/types/sankey-metadata'
import type { UUID } from 'iom-sdk'
import { useStatements } from '@/hooks'
import { LoadingState } from '@/components/loading-state'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import { 
  SankeyDiagram, 
  NetworkDiagram, 
  ProcessViewSelector, 
  ProcessCreateSheet, 
  RelationshipDetailsSheet, 
  DashboardView, 
  MaterialSelector,
  ProcessTableView,
  useSankeyDiagramData
} from '@/components/processes'

import { ProcessViewType, ENABLED_PROCESS_VIEW_TYPES } from '@/constants'

const MaterialFlowPage = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const objectUuid = searchParams.get('objectUuid')

  const [selectedRelationship, setSelectedRelationship] =
    useState<EnhancedMaterialRelationship | null>(null)
  const [isProcessFormOpen, setIsProcessFormOpen] = useState(false)
  const [isRelationshipSheetOpen, setIsRelationshipSheetOpen] = useState(false)
  const [activeView, setActiveView] = useState<ProcessViewType>('dashboard')
  const [selectedMaterialUuids, setSelectedMaterialUuids] = useState<string[]>([])

  // Load saved view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('processView') as ProcessViewType
    const validViews = ENABLED_PROCESS_VIEW_TYPES.map((type) => type.value)
    if (savedView && validViews.includes(savedView)) {
      setActiveView(savedView)
    }
  }, [])

  const clearFilter = useCallback(() => {
    router.push('/processes')
  }, [router])

  // Enhanced data fetching using new metadata-driven hook
  const { materials: allMaterials, relationships: allRelationships, isLoading } = useSankeyDiagramData(
    objectUuid as UUID | undefined
  )

  // Filter data based on selected materials
  const { materials, relationships } = useMemo(() => {
    if (selectedMaterialUuids.length === 0) {
      return { materials: allMaterials, relationships: allRelationships }
    }

    // Filter relationships that involve any of the selected materials
    const filteredRelationships = allRelationships.filter(rel =>
      selectedMaterialUuids.includes(rel.subject.uuid) || selectedMaterialUuids.includes(rel.object.uuid)
    )

    // Get all materials involved in the filtered relationships
    const involvedMaterialUuids = new Set<string>()
    filteredRelationships.forEach(rel => {
      involvedMaterialUuids.add(rel.subject.uuid)
      involvedMaterialUuids.add(rel.object.uuid)
    })

    const filteredMaterials = allMaterials.filter(material =>
      involvedMaterialUuids.has(material.uuid)
    )

    return { materials: filteredMaterials, relationships: filteredRelationships }
  }, [allMaterials, allRelationships, selectedMaterialUuids])

  // API hooks for mutations only
  const { useCreateProcessFlow } = useStatements()
  const createProcessFlowMutation = useCreateProcessFlow()

  const handleProcessSave = useCallback(async (newProcess: any) => {
    try {
      toast.loading('Creating process flow...', { id: 'create-process-flow' })
      const result = await createProcessFlowMutation.mutateAsync({
        processMetadata: {
          processName: newProcess.name,
          processType: newProcess.type,
          quantity: 0,
          unit: 'kg',
          ...(newProcess.processMetadata || {}),
        },
        inputMaterials: newProcess.inputMaterials.map((input: any) => ({
          uuid: input.object.uuid,
          quantity: input.quantity,
          unit: input.unit,
          metadata: {
            ...(input.metadata || {}),
            ...(input.customProperties || {}), // Merge custom properties into metadata
          },
        })),
        outputMaterials: newProcess.outputMaterials.map((output: any) => ({
          uuid: output.object.uuid,
          quantity: output.quantity,
          unit: output.unit,
          metadata: {
            ...(output.metadata || {}),
            ...(output.customProperties || {}), // Merge custom properties into metadata
          },
        })),
      })

      console.log('Process flow saved to backend:', result)
      toast.success('Process flow created successfully!', {
        id: 'create-process-flow',
      })
      setIsProcessFormOpen(false)
    } catch (error) {
      console.error('Failed to save process flow:', error)
      toast.error('Failed to create process flow', {
        id: 'create-process-flow',
      })
    }
  }, [createProcessFlowMutation])

  const handleRelationshipSelect = useCallback((relationship: EnhancedMaterialRelationship) => {
    // Don't set selectedRelationship to avoid diagram re-render/flicker
    // Just open the sheet with the relationship data
    setIsRelationshipSheetOpen(true)
    // Set the relationship after a brief delay to avoid affecting the diagram
    setTimeout(() => {
      setSelectedRelationship(relationship)
    }, 0)
  }, [])

  const handleCloseRelationshipSheet = useCallback(() => {
    setIsRelationshipSheetOpen(false)
    setSelectedRelationship(null)
  }, [])

  const handleCloseProcessForm = useCallback(() => {
    setIsProcessFormOpen(false)
  }, [])

  const handleOpenProcessForm = useCallback(() => {
    setIsProcessFormOpen(true)
  }, [])



  // Memoize diagram components to prevent unnecessary re-renders
  // Remove selectedRelationship from dependencies to prevent flicker on selection
  const diagramContent = useMemo(() => {
    if (isLoading || materials.length === 0 || relationships.length === 0) {
      return (
        <LoadingState
          isLoading={isLoading}
          hasNoData={materials.length === 0 || relationships.length === 0}
          objectUuid={objectUuid}
          setIsProcessFormOpen={setIsProcessFormOpen}
          variant="inline"
        />
      )
    }

    return activeView === 'network' ? (
      <NetworkDiagram
        materials={materials}
        relationships={relationships}
        selectedRelationship={null} // Always null to prevent visual selection
        onLinkSelect={handleRelationshipSelect}
        className="bg-white"
      />
    ) : (
      <SankeyDiagram
        materials={materials}
        relationships={relationships}
        selectedRelationship={null} // Always null to prevent visual selection
        onLinkSelect={handleRelationshipSelect}
        className="bg-white"
      />
    )
  }, [materials, relationships, isLoading, activeView, objectUuid, handleRelationshipSelect])

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex flex-wrap gap-6 justify-between items-center">
        <h1 className="text-2xl font-bold">I/O Processes</h1>
        <div className="flex flex-wrap items-center gap-4">
          {/* Material Filter Selector */}
          <MaterialSelector
            materials={allMaterials}
            selectedMaterialUuids={selectedMaterialUuids}
            onMaterialsChange={setSelectedMaterialUuids}
            placeholder="Filter by objects..."
            maxSelections={10}
          />
          <ProcessViewSelector view={activeView} onChange={setActiveView} />
          <Button
            onClick={handleOpenProcessForm}
            className="flex-shrink-0"
            disabled={createProcessFlowMutation.isPending}
          >
            {createProcessFlowMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Create Process
          </Button>
        </div>
      </div>

      {/* Filter Mode Indicator */}
      {(objectUuid || selectedMaterialUuids.length > 0) && (
        <div className="mb-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-orange-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-orange-900">
                    Active Filters:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {objectUuid && (
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-700 font-mono text-xs"
                    >
                      Object: {objectUuid.slice(0, 8)}...
                    </Badge>
                  )}
                  {selectedMaterialUuids.map(uuid => {
                    const material = allMaterials.find(m => m.uuid === uuid)
                    return (
                      <Badge
                        key={uuid}
                        variant="secondary"
                        className="bg-orange-100 text-orange-700 text-xs"
                      >
                        {material?.name || `${uuid.slice(0, 8)}...`}
                      </Badge>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                {selectedMaterialUuids.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMaterialUuids([])}
                    className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 flex-shrink-0 text-xs"
                  >
                    Clear Materials
                  </Button>
                )}
                {objectUuid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilter}
                    className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 flex-shrink-0 text-xs"
                  >
                    Clear Object
                  </Button>
                )}
                {(objectUuid && selectedMaterialUuids.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedMaterialUuids([])
                      clearFilter()
                    }}
                    className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 flex-shrink-0 text-xs"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard View */}
      {activeView === 'dashboard' && (
        <>
          {isLoading || materials.length === 0 || relationships.length === 0 ? (
            <LoadingState
              isLoading={isLoading}
              hasNoData={materials.length === 0 || relationships.length === 0}
              objectUuid={objectUuid}
              setIsProcessFormOpen={setIsProcessFormOpen}
              variant="card"
            />
          ) : (
            <DashboardView
              materials={materials} // Use filtered materials
              relationships={relationships} // Use filtered relationships for analytics
              onCreateProcess={handleOpenProcessForm}
            />
          )}
        </>
      )}

      {/* Diagram Views */}
      {(activeView === 'sankey' || activeView === 'network') && (
        <Card>
          <CardContent>
            {diagramContent}
          </CardContent>
        </Card>
      )}

      {/* Table View */}
      {activeView === 'table' && (
        <div className="space-y-6">
          <LoadingState
            isLoading={isLoading}
            hasNoData={relationships.length === 0}
            objectUuid={objectUuid}
            setIsProcessFormOpen={setIsProcessFormOpen}
            variant="card"
          />
          {!isLoading && relationships.length > 0 && (
            <ProcessTableView
              relationships={relationships}
              selectedRelationship={null} // Remove selection highlighting from table too
              onRelationshipSelect={handleRelationshipSelect}
              pageSize={15}
            />
          )}
        </div>
      )}

      {/* Process Form Sheet */}
      <ProcessCreateSheet
        isOpen={isProcessFormOpen}
        onClose={handleCloseProcessForm}
        onSave={handleProcessSave}
      />

      {/* Relationship Details Sheet */}
      <RelationshipDetailsSheet
        relationship={selectedRelationship}
        isOpen={isRelationshipSheetOpen}
        onClose={handleCloseRelationshipSheet}
      />
    </div>
  )
}

export default MaterialFlowPage
