'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PlusCircle, Network, BarChart3, Loader2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
} from '@/components/ui'
import { MaterialRelationship } from '@/types'
import { useStatements, useSankeyData } from '@/hooks'
import { ProcessFormSheet } from '@/components/sheets'
import { RelationshipsTable } from '@/components/tables'
import { RelationshipDetailsSheet } from '@/components/sheets'
import { NetworkDiagram, SankeyDiagram } from '@/components/diagrams'

const MaterialFlowPage = () => {
  const searchParams = useSearchParams()
  const objectUuid = searchParams.get('objectUuid')

  const [selectedRelationship, setSelectedRelationship] =
    useState<MaterialRelationship | null>(null)
  const [isProcessFormOpen, setIsProcessFormOpen] = useState(false)
  const [isRelationshipSheetOpen, setIsRelationshipSheetOpen] = useState(false)
  const [activeVisualization, setActiveVisualization] = useState<
    'sankey' | 'network'
  >('sankey')

  // Simplified data fetching using custom hook
  const { materials, relationships, isLoading } = useSankeyData({
    objectUuid,
  })

  // API hooks for mutations only
  const { useCreateProcessFlow } = useStatements()
  const createProcessFlowMutation = useCreateProcessFlow()

  const handleProcessSave = async (newProcess: any) => {
    try {
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
      setIsProcessFormOpen(false)
    } catch (error) {
      console.error('Failed to save process flow:', error)
      // You might want to show an error toast here
    }
  }

  const handleRelationshipSelect = (relationship: MaterialRelationship) => {
    setSelectedRelationship(relationship)
    setIsRelationshipSheetOpen(true)
  }

  // Debug: Uncomment for troubleshooting
  // console.log('Processes data:', { materials, relationships })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">I/O Processes</h1>
          {objectUuid && (
            <p className="text-sm text-muted-foreground mt-1">
              Filtered by object: {objectUuid.slice(-8)}...
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
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

      <Tabs defaultValue="diagram" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
          <TabsTrigger value="management">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="diagram" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div></div>
                <div className="flex gap-2">
                  <Button
                    variant={
                      activeVisualization === 'network' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setActiveVisualization('network')}
                    className="flex items-center gap-2"
                  >
                    <Network className="h-4 w-4" />
                    Network
                  </Button>
                  <Button
                    variant={
                      activeVisualization === 'sankey' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setActiveVisualization('sankey')}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Sankey
                  </Button>
                </div>
              </div>
            </CardHeader>
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
                (activeVisualization === 'network' ? (
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
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
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
            />
          )}
        </TabsContent>
      </Tabs>

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
        onClose={() => setIsRelationshipSheetOpen(false)}
      />
    </div>
  )
}

export default MaterialFlowPage

function LoadingState({
  isLoading,
  hasNoData,
  objectUuid,
  setIsProcessFormOpen,
  variant = 'card',
}: {
  isLoading: boolean
  hasNoData: boolean
  objectUuid: string | null
  setIsProcessFormOpen: (isOpen: boolean) => void
  variant?: 'card' | 'inline'
}) {
  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading process data...</p>
        </div>
      </div>
    )

    if (variant === 'inline') {
      return (
        <div className="h-64 flex items-center justify-center">
          {loadingContent}
        </div>
      )
    }

    return (
      <Card>
        <CardContent className="h-96 flex items-center justify-center p-8">
          {loadingContent}
        </CardContent>
      </Card>
    )
  }

  if (hasNoData) {
    const emptyContent = (
      <div className="text-center">
        <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No I/O Processes</h3>
        <p className="text-muted-foreground mb-4">
          {objectUuid
            ? 'No I/O processes found for the selected object.'
            : 'No I/O processes have been created yet.'}
        </p>
        <Button onClick={() => setIsProcessFormOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create First Process
        </Button>
      </div>
    )

    if (variant === 'inline') {
      return (
        <div className="h-64 flex items-center justify-center">
          {emptyContent}
        </div>
      )
    }

    return (
      <Card>
        <CardContent className="p-8">{emptyContent}</CardContent>
      </Card>
    )
  }

  return null
}
