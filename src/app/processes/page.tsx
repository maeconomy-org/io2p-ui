'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PlusCircle, Loader2, Filter, X } from 'lucide-react'
import { toast } from 'sonner'

import { MaterialRelationship } from '@/types'
import { useStatements, useSankeyData } from '@/hooks'
import { RelationshipsTable } from '@/components/tables'
import { LoadingState } from '@/components/loading-state'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import { NetworkDiagram, SankeyDiagram } from '@/components/diagrams'
import { ProcessViewSelector } from '@/components/process-view-selector'
import { ProcessFormSheet, RelationshipDetailsSheet } from '@/components/sheets'
import { ProcessViewType, ENABLED_PROCESS_VIEW_TYPES } from '@/constants'

const MaterialFlowPage = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const objectUuid = searchParams.get('objectUuid')

  const [selectedRelationship, setSelectedRelationship] =
    useState<MaterialRelationship | null>(null)
  const [isProcessFormOpen, setIsProcessFormOpen] = useState(false)
  const [isRelationshipSheetOpen, setIsRelationshipSheetOpen] = useState(false)
  const [activeView, setActiveView] = useState<ProcessViewType>('sankey')

  // Load saved view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('processView') as ProcessViewType
    const validViews = ENABLED_PROCESS_VIEW_TYPES.map((type) => type.value)
    if (savedView && validViews.includes(savedView)) {
      setActiveView(savedView)
    }
  }, [])

  const clearFilter = () => {
    router.push('/processes')
  }

  // Simplified data fetching using custom hook
  const { materials, relationships, isLoading } = useSankeyData({
    objectUuid,
  })

  // API hooks for mutations only
  const { useCreateProcessFlow } = useStatements()
  const createProcessFlowMutation = useCreateProcessFlow()

  const handleProcessSave = async (newProcess: any) => {
    try {
      toast.loading('Creating process flow...', { id: 'create-process-flow' })
      const result = await createProcessFlowMutation.mutateAsync({
        processName: newProcess.name,
        processType: newProcess.type,
        inputMaterials: newProcess.inputMaterials.map((input: any) => ({
          uuid: input.object.uuid,
          quantity: input.quantity,
          unit: input.unit,
        })),
        outputMaterials: newProcess.outputMaterials.map((output: any) => ({
          uuid: output.object.uuid,
          quantity: output.quantity,
          unit: output.unit,
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
  }

  const handleRelationshipSelect = (relationship: MaterialRelationship) => {
    setSelectedRelationship(relationship)
    setIsRelationshipSheetOpen(true)
  }

  // Debug: Uncomment for troubleshooting
  // console.log('Processes data:', { materials, relationships })

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">I/O Processes</h1>
        <div className="flex items-center gap-4">
          <ProcessViewSelector view={activeView} onChange={setActiveView} />
          <Button
            onClick={() => setIsProcessFormOpen(true)}
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
      {objectUuid && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <span className="text-sm font-medium text-orange-900 truncate">
                  Filtered by Object:
                </span>
              </div>
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-700 whitespace-nowrap font-mono"
              >
                {objectUuid}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 flex-shrink-0"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filter
            </Button>
          </div>
        </div>
      )}

      {/* Diagram Views */}
      {(activeView === 'sankey' || activeView === 'network') && (
        <Card>
          <CardContent>
            <LoadingState
              isLoading={isLoading}
              hasNoData={materials.length === 0 || relationships.length === 0}
              objectUuid={objectUuid}
              setIsProcessFormOpen={setIsProcessFormOpen}
              variant="inline"
            />
            {!isLoading &&
              materials.length > 0 &&
              relationships.length > 0 &&
              (activeView === 'network' ? (
                <NetworkDiagram
                  materials={materials}
                  relationships={relationships}
                  selectedRelationship={selectedRelationship}
                  onLinkSelect={handleRelationshipSelect}
                  className="bg-white"
                />
              ) : (
                <SankeyDiagram
                  materials={materials}
                  relationships={relationships}
                  selectedRelationship={selectedRelationship}
                  onLinkSelect={handleRelationshipSelect}
                  className="bg-white"
                />
              ))}
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
            <RelationshipsTable
              relationships={relationships}
              selectedRelationship={selectedRelationship}
              onRelationshipSelect={handleRelationshipSelect}
              pageSize={15}
            />
          )}
        </div>
      )}

      {/* Process Form Sheet */}
      <ProcessFormSheet
        isOpen={isProcessFormOpen}
        onClose={() => setIsProcessFormOpen(false)}
        onSave={handleProcessSave}
      />

      {/* Relationship Details Sheet */}
      <RelationshipDetailsSheet
        relationship={selectedRelationship}
        isOpen={isRelationshipSheetOpen}
        onClose={() => {
          setIsRelationshipSheetOpen(false)
          setSelectedRelationship(null)
        }}
      />
    </div>
  )
}

export default MaterialFlowPage
