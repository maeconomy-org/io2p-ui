'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  PlusCircle,
  Loader2,
  Filter,
  Layers,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UUID } from 'iom-sdk'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'

import { EnhancedMaterialRelationship } from '@/types/sankey-metadata'
import { useStatements } from '@/hooks'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import {
  LoadingState,
  ProcessViewSelector,
  ProcessCreateSheet,
  RelationshipDetailsSheet,
  DashboardView,
  MaterialSelector,
  ProcessTableView,
  useSankeyDiagramData,
} from '@/components/processes'

import { ProcessViewType, ENABLED_PROCESS_VIEW_TYPES } from '@/constants'
import { logger } from '@/lib'

// Simple loading placeholder for dynamic imports
const DiagramLoader = () => (
  <div className="flex items-center justify-center h-96">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
)

// Lazy load heavy diagram components (echarts ~300KB)
const SankeyDiagram = dynamic(
  () =>
    import('@/components/processes/views/sankey-view').then(
      (mod) => mod.SankeyDiagram
    ),
  { loading: () => <DiagramLoader />, ssr: false }
)

const NetworkDiagram = dynamic(
  () =>
    import('@/components/processes/views/network-view').then(
      (mod) => mod.NetworkDiagram
    ),
  { loading: () => <DiagramLoader />, ssr: false }
)

const MaterialFlowPage = () => {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const router = useRouter()
  const objectUuid = searchParams.get('objectUuid')

  const [selectedRelationship, setSelectedRelationship] =
    useState<EnhancedMaterialRelationship | null>(null)
  const [isProcessFormOpen, setIsProcessFormOpen] = useState(false)
  const [isRelationshipSheetOpen, setIsRelationshipSheetOpen] = useState(false)
  const [activeView, setActiveView] = useState<ProcessViewType>('dashboard')
  const [selectedMaterialUuids, setSelectedMaterialUuids] = useState<string[]>(
    []
  )
  const [isDepthLimited, setIsDepthLimited] = useState(true)

  // Drill-down state: stack of focus nodes for breadcrumb navigation
  // Each entry is { uuid, name } — empty stack means showing from roots
  const [drillDownStack, setDrillDownStack] = useState<
    Array<{ uuid: string; name: string }>
  >([])
  const currentFocusNode =
    drillDownStack.length > 0
      ? drillDownStack[drillDownStack.length - 1].uuid
      : undefined

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

  // Data fetching with depth limiting at the fetch level.
  // When depth-limited, the hook only fetches objects within 3 topological levels,
  // avoiding unnecessary API calls for deep nodes in large graphs.
  // focusNode enables drill-down: BFS starts from that node instead of roots.
  const {
    materials: allMaterials,
    relationships: allRelationships,
    isLoading,
    totalNodeCount,
  } = useSankeyDiagramData(objectUuid as UUID | undefined, {
    maxDepth: isDepthLimited ? 3 : undefined,
    focusNode: isDepthLimited ? currentFocusNode : undefined,
  })

  // Truncated count = total nodes in graph minus nodes actually fetched
  const truncatedCount = isDepthLimited
    ? Math.max(0, totalNodeCount - allMaterials.length)
    : 0

  // Filter data based on selected materials
  const { materials, relationships } = useMemo(() => {
    if (selectedMaterialUuids.length === 0) {
      return { materials: allMaterials, relationships: allRelationships }
    }

    const filteredRels = allRelationships.filter(
      (rel) =>
        selectedMaterialUuids.includes(rel.subject.uuid) ||
        selectedMaterialUuids.includes(rel.object.uuid)
    )

    const involvedMaterialUuids = new Set<string>()
    filteredRels.forEach((rel) => {
      involvedMaterialUuids.add(rel.subject.uuid)
      involvedMaterialUuids.add(rel.object.uuid)
    })

    return {
      materials: allMaterials.filter((m) => involvedMaterialUuids.has(m.uuid)),
      relationships: filteredRels,
    }
  }, [allMaterials, allRelationships, selectedMaterialUuids])

  // API hooks for mutations only
  const { useCreateProcessFlow } = useStatements()
  const createProcessFlowMutation = useCreateProcessFlow()

  const handleProcessSave = useCallback(
    async (newProcess: any) => {
      try {
        toast.loading(t('processes.form.createTitle'), {
          id: 'create-process-flow',
        })
        await createProcessFlowMutation.mutateAsync({
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

        toast.success(t('processes.create'), {
          id: 'create-process-flow',
        })
        setIsProcessFormOpen(false)
      } catch (error) {
        logger.error('Failed to save process flow:', { error })
        toast.error(t('processes.create'), {
          id: 'create-process-flow',
        })
      }
    },
    [createProcessFlowMutation, t]
  )

  const handleRelationshipSelect = useCallback(
    (relationship: EnhancedMaterialRelationship) => {
      // Don't set selectedRelationship to avoid diagram re-render/flicker
      // Just open the sheet with the relationship data
      setIsRelationshipSheetOpen(true)
      // Set the relationship after a brief delay to avoid affecting the diagram
      setTimeout(() => {
        setSelectedRelationship(relationship)
      }, 0)
    },
    []
  )

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

  // Drill-down: click a node to make it the new focus (first level)
  const handleNodeDrillDown = useCallback(
    (nodeUuid: string, nodeName: string) => {
      if (!isDepthLimited) return
      // Only drill down if the node has outgoing edges (children in the graph)
      const hasOutgoing = allRelationships.some(
        (rel) => rel.subject.uuid === nodeUuid
      )
      if (hasOutgoing) {
        setDrillDownStack((prev) => [
          ...prev,
          { uuid: nodeUuid, name: nodeName },
        ])
      }
    },
    [isDepthLimited, allRelationships]
  )

  // Navigate back in drill-down breadcrumb
  const handleDrillDownBack = useCallback((index: number) => {
    setDrillDownStack((prev) => prev.slice(0, index))
  }, [])

  const handleDrillDownReset = useCallback(() => {
    setDrillDownStack([])
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
        className="bg-card"
      />
    ) : (
      <SankeyDiagram
        materials={materials}
        relationships={relationships}
        selectedRelationship={null} // Always null to prevent visual selection
        onLinkSelect={handleRelationshipSelect}
        onNodeClick={isDepthLimited ? handleNodeDrillDown : undefined}
        className="bg-card"
      />
    )
  }, [
    materials,
    relationships,
    isLoading,
    activeView,
    objectUuid,
    handleRelationshipSelect,
    handleNodeDrillDown,
    isDepthLimited,
  ])

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex flex-wrap gap-6 justify-between items-center">
        <h1 className="text-2xl font-bold">{t('processes.title')}</h1>
        <div className="flex flex-wrap items-center gap-4">
          {/* Material Filter Selector */}
          <MaterialSelector
            materials={allMaterials}
            selectedMaterialUuids={selectedMaterialUuids}
            onMaterialsChange={setSelectedMaterialUuids}
            placeholder={t('processes.filterObjects')}
            maxSelections={10}
          />
          {/* Depth Limit Toggle */}
          <Button
            variant={isDepthLimited ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsDepthLimited(!isDepthLimited)}
            className="flex-shrink-0 gap-1.5"
          >
            <Layers className="h-4 w-4" />
            {isDepthLimited
              ? t('processes.depthLimited')
              : t('processes.depthFull')}
            {isDepthLimited && truncatedCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-[10px]"
              >
                +{truncatedCount}
              </Badge>
            )}
          </Button>
          <ProcessViewSelector view={activeView} onChange={setActiveView} />
          <Button
            size="sm"
            className="flex-shrink-0"
            onClick={handleOpenProcessForm}
            disabled={createProcessFlowMutation.isPending}
          >
            {createProcessFlowMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {t('processes.create')}
          </Button>
        </div>
      </div>

      {/* Filter Mode Indicator */}
      {(objectUuid || selectedMaterialUuids.length > 0) && (
        <div className="mb-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-orange-900 dark:text-orange-200">
                    {t('processes.filters')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {objectUuid && (
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-mono text-xs"
                    >
                      {t('processes.object')}: {objectUuid.slice(0, 8)}...
                    </Badge>
                  )}
                  {selectedMaterialUuids.map((uuid) => {
                    const material = allMaterials.find((m) => m.uuid === uuid)
                    return (
                      <Badge
                        key={uuid}
                        variant="secondary"
                        className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs"
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
                    className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 flex-shrink-0 text-xs"
                  >
                    {t('processes.clearMaterials')}
                  </Button>
                )}
                {objectUuid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilter}
                    className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 flex-shrink-0 text-xs"
                  >
                    {t('processes.clearObject')}
                  </Button>
                )}
                {objectUuid && selectedMaterialUuids.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedMaterialUuids([])
                      clearFilter()
                    }}
                    className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 flex-shrink-0 text-xs"
                  >
                    {t('processes.clearAll')}
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

      {/* Drill-down Breadcrumb */}
      {isDepthLimited &&
        drillDownStack.length > 0 &&
        (activeView === 'sankey' || activeView === 'network') && (
          <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sm flex-wrap min-w-0">
                <button
                  onClick={handleDrillDownReset}
                  className="text-primary hover:underline font-medium shrink-0"
                >
                  {t('processes.drillDown.root')}
                </button>
                {drillDownStack.map((node, index) => (
                  <span key={node.uuid} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {index < drillDownStack.length - 1 ? (
                      <button
                        onClick={() => handleDrillDownBack(index + 1)}
                        className="text-primary hover:underline truncate max-w-[200px]"
                      >
                        {node.name}
                      </button>
                    ) : (
                      <span className="font-medium truncate max-w-[200px]">
                        {node.name}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDrillDownReset}
                className="shrink-0 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('processes.drillDown.reset')}
              </Button>
            </div>
          </div>
        )}

      {/* Diagram Views */}
      {(activeView === 'sankey' || activeView === 'network') && (
        <Card>
          <CardContent>{diagramContent}</CardContent>
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
