'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SankeyDiagram, NetworkDiagram } from '@/components/processes/diagrams'
import type { 
  EnhancedMaterialObject, 
  EnhancedMaterialRelationship 
} from '@/types'

/**
 * Demo page showing the new metadata-driven Sankey diagram
 * Based on the reference example from docs/sankey-diagram-plan.md section 8
 */
export default function SankeyDemoPage() {
  const [selectedRelationship, setSelectedRelationship] = useState<EnhancedMaterialRelationship | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<EnhancedMaterialObject | null>(null)

  // Sample materials based on the reference example
  const sampleMaterials: EnhancedMaterialObject[] = [
    // Raw materials extraction (stage 0.0)
    {
      uuid: 'clay-uuid',
      name: 'Clay',
      type: 'input',
      lifecycleStage: 'PRIMARY_INPUT',
      color: '#1E40AF',
      domainCategoryCode: 'MASONRY',
    },
    {
      uuid: 'iron-ore-uuid',
      name: 'Iron Ore',
      type: 'input',
      lifecycleStage: 'PRIMARY_INPUT',
      color: '#1E40AF',
      domainCategoryCode: 'STEEL',
    },
    {
      uuid: 'limestone-uuid',
      name: 'Limestone',
      type: 'input',
      lifecycleStage: 'PRIMARY_INPUT',
      color: '#1E40AF',
      domainCategoryCode: 'CONCRETE',
    },
    {
      uuid: 'water-uuid',
      name: 'Water',
      type: 'input',
      lifecycleStage: 'PRIMARY_INPUT',
      color: '#1E40AF',
      domainCategoryCode: 'CONCRETE',
    },
    {
      uuid: 'crushed-stone-uuid',
      name: 'Crushed Stone',
      type: 'input',
      lifecycleStage: 'PRIMARY_INPUT',
      color: '#1E40AF',
      domainCategoryCode: 'CONCRETE',
    },

    // Processed materials (stage 0.5-1.0)
    {
      uuid: 'virgin-brick-uuid',
      name: 'Virgin Brick',
      type: 'intermediate',
      lifecycleStage: 'PROCESSING',
      color: '#8B5CF6',
      domainCategoryCode: 'MASONRY',
    },
    {
      uuid: 'virgin-steel-beam-uuid',
      name: 'Virgin Steel Beam',
      type: 'intermediate',
      lifecycleStage: 'PROCESSING',
      color: '#8B5CF6',
      domainCategoryCode: 'STEEL',
    },
    {
      uuid: 'virgin-rebar-uuid',
      name: 'Virgin Rebar',
      type: 'intermediate',
      lifecycleStage: 'PROCESSING',
      color: '#8B5CF6',
      domainCategoryCode: 'STEEL',
    },
    {
      uuid: 'virgin-concrete-uuid',
      name: 'Virgin Concrete',
      type: 'intermediate',
      lifecycleStage: 'PROCESSING',
      color: '#8B5CF6',
      domainCategoryCode: 'CONCRETE',
    },

    // Multiple buildings (stage 3.5-4.0)
    {
      uuid: 'building-a-uuid',
      name: 'Building A (Office)',
      type: 'intermediate',
      lifecycleStage: 'USE_PHASE',
      color: '#047857',
      sourceBuildingUuid: 'building-a-uuid',
    },
    {
      uuid: 'building-old1-uuid',
      name: 'Old Warehouse',
      type: 'intermediate',
      lifecycleStage: 'USE_PHASE',
      color: '#047857',
      sourceBuildingUuid: 'building-old1-uuid',
    },
    {
      uuid: 'building-old2-uuid',
      name: 'Old Factory',
      type: 'intermediate',
      lifecycleStage: 'USE_PHASE',
      color: '#047857',
      sourceBuildingUuid: 'building-old2-uuid',
    },
    
    // Reclaimed materials from multiple buildings
    {
      uuid: 'reclaimed-brick-a-uuid',
      name: 'Reclaimed Brick (from Office)',
      type: 'intermediate',
      lifecycleStage: 'REUSED_COMPONENT',
      isReusedComponent: true,
      color: '#06B6D4',
      sourceBuildingUuid: 'building-a-uuid',
      domainCategoryCode: 'MASONRY',
    },
    {
      uuid: 'reclaimed-steel-a-uuid',
      name: 'Reclaimed Steel (from Office)',
      type: 'intermediate',
      lifecycleStage: 'REUSED_COMPONENT',
      isReusedComponent: true,
      color: '#06B6D4',
      sourceBuildingUuid: 'building-a-uuid',
      domainCategoryCode: 'STEEL',
    },
    {
      uuid: 'reclaimed-steel-warehouse-uuid',
      name: 'Reclaimed Steel (from Warehouse)',
      type: 'intermediate',
      lifecycleStage: 'REUSED_COMPONENT',
      isReusedComponent: true,
      color: '#06B6D4',
      sourceBuildingUuid: 'building-old1-uuid',
      domainCategoryCode: 'STEEL',
    },
    {
      uuid: 'reclaimed-rebar-factory-uuid',
      name: 'Reclaimed Rebar (from Factory)',
      type: 'intermediate',
      lifecycleStage: 'REUSED_COMPONENT',
      isReusedComponent: true,
      color: '#06B6D4',
      sourceBuildingUuid: 'building-old2-uuid',
      domainCategoryCode: 'STEEL',
    },
    {
      uuid: 'concrete-waste-mixed-uuid',
      name: 'Mixed Concrete Waste',
      type: 'intermediate',
      lifecycleStage: 'WASTE',
      color: '#F59E0B',
      domainCategoryCode: 'CONCRETE',
    },

    // Recycled materials
    {
      uuid: 'recycled-aggregate-uuid',
      name: 'Recycled Aggregate',
      type: 'intermediate',
      lifecycleStage: 'SECONDARY_INPUT',
      isRecyclingMaterial: true,
      color: '#3B82F6',
      domainCategoryCode: 'CONCRETE',
    },
    {
      uuid: 'recycled-steel-uuid',
      name: 'Recycled Steel',
      type: 'intermediate',
      lifecycleStage: 'SECONDARY_INPUT',
      isRecyclingMaterial: true,
      color: '#3B82F6',
      domainCategoryCode: 'STEEL',
    },

    // Some virgin materials still needed
    {
      uuid: 'virgin-cement-uuid',
      name: 'Virgin Cement',
      type: 'intermediate',
      lifecycleStage: 'PROCESSING',
      color: '#8B5CF6',
      domainCategoryCode: 'CONCRETE',
    },

    // Waste streams
    {
      uuid: 'landfill-uuid',
      name: 'Landfill',
      type: 'output',
      lifecycleStage: 'DISPOSAL',
      color: '#DC2626',
    },
    {
      uuid: 'steel-scrap-uuid',
      name: 'Steel Scrap (unusable)',
      type: 'output',
      lifecycleStage: 'WASTE',
      color: '#F59E0B',
    },

    // Multiple new buildings (targets)
    {
      uuid: 'building-b-uuid',
      name: 'New Residential Complex',
      type: 'output',
      lifecycleStage: 'PRODUCT',
      color: '#059669',
      targetBuildingUuid: 'building-b-uuid',
    },
    {
      uuid: 'building-c-uuid',
      name: 'New Community Center',
      type: 'output',
      lifecycleStage: 'PRODUCT',
      color: '#059669',
      targetBuildingUuid: 'building-c-uuid',
    },
  ]

  // Sample relationships with metadata
  const sampleRelationships: EnhancedMaterialRelationship[] = [
    // === RAW MATERIAL PROCESSING (Stage 0 → 1) ===
    
    // Brick manufacturing
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'clay-uuid', name: 'Clay' },
      object: { uuid: 'virgin-brick-uuid', name: 'Virgin Brick' },
      quantity: 6000,
      unit: 'kg',
      processName: 'Brick Manufacturing',
      processTypeCode: 'PRODUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 1200,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 15,
      qualityChangeCode: 'UP',
      notes: 'Clay fired in kilns to create bricks',
    },

    // Steel production
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'iron-ore-uuid', name: 'Iron Ore' },
      object: { uuid: 'virgin-steel-beam-uuid', name: 'Virgin Steel Beam' },
      quantity: 3000,
      unit: 'kg',
      processName: 'Steel Beam Production',
      processTypeCode: 'PRODUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 4500,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 25,
      qualityChangeCode: 'UP',
      notes: 'Iron ore smelted and formed into structural beams',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'iron-ore-uuid', name: 'Iron Ore' },
      object: { uuid: 'virgin-rebar-uuid', name: 'Virgin Rebar' },
      quantity: 1500,
      unit: 'kg',
      processName: 'Rebar Production',
      processTypeCode: 'PRODUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 2250,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 20,
      qualityChangeCode: 'UP',
      notes: 'Iron ore processed into reinforcement bars',
    },

    // Concrete production
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'limestone-uuid', name: 'Limestone' },
      object: { uuid: 'virgin-concrete-uuid', name: 'Virgin Concrete' },
      quantity: 8000,
      unit: 'kg',
      processName: 'Concrete Production',
      processTypeCode: 'PRODUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 1600,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 5,
      qualityChangeCode: 'UP',
      notes: 'Limestone processed into cement, mixed with aggregates',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'water-uuid', name: 'Water' },
      object: { uuid: 'virgin-concrete-uuid', name: 'Virgin Concrete' },
      quantity: 2000,
      unit: 'kg',
      processName: 'Concrete Production',
      processTypeCode: 'PRODUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 10,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Water for concrete mixing',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'crushed-stone-uuid', name: 'Crushed Stone' },
      object: { uuid: 'virgin-concrete-uuid', name: 'Virgin Concrete' },
      quantity: 12000,
      unit: 'kg',
      processName: 'Concrete Production',
      processTypeCode: 'PRODUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 120,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 2,
      qualityChangeCode: 'SAME',
      notes: 'Crushed stone as concrete aggregate',
    },

    // === ORIGINAL BUILDING CONSTRUCTION (Stage 1 → 3.5) ===
    
    // Building A construction
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-brick-uuid', name: 'Virgin Brick' },
      object: { uuid: 'building-a-uuid', name: 'Building A (Office)' },
      quantity: 5100,
      unit: 'kg',
      processName: 'Office Building Construction (1994)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 255,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 3,
      qualityChangeCode: 'SAME',
      notes: 'Brick facade for office building',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-steel-beam-uuid', name: 'Virgin Steel Beam' },
      object: { uuid: 'building-a-uuid', name: 'Building A (Office)' },
      quantity: 2250,
      unit: 'kg',
      processName: 'Office Building Construction (1994)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 112,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 2,
      qualityChangeCode: 'SAME',
      notes: 'Steel frame for office building',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-concrete-uuid', name: 'Virgin Concrete' },
      object: { uuid: 'building-a-uuid', name: 'Building A (Office)' },
      quantity: 22000,
      unit: 'kg',
      processName: 'Office Building Construction (1994)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 440,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 1,
      qualityChangeCode: 'SAME',
      notes: 'Foundation and floors',
    },

    // Warehouse construction (different materials mix)
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-steel-beam-uuid', name: 'Virgin Steel Beam' },
      object: { uuid: 'building-old1-uuid', name: 'Old Warehouse' },
      quantity: 8000,
      unit: 'kg',
      processName: 'Warehouse Construction (1985)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 400,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 2,
      qualityChangeCode: 'SAME',
      notes: 'Heavy steel frame warehouse',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-concrete-uuid', name: 'Virgin Concrete' },
      object: { uuid: 'building-old1-uuid', name: 'Old Warehouse' },
      quantity: 35000,
      unit: 'kg',
      processName: 'Warehouse Construction (1985)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 700,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 1,
      qualityChangeCode: 'SAME',
      notes: 'Large concrete foundation and floor',
    },

    // Factory construction (rebar-heavy)
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-rebar-uuid', name: 'Virgin Rebar' },
      object: { uuid: 'building-old2-uuid', name: 'Old Factory' },
      quantity: 1200,
      unit: 'kg',
      processName: 'Factory Construction (1978)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 60,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 5,
      qualityChangeCode: 'SAME',
      notes: 'Reinforced concrete factory structure',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-concrete-uuid', name: 'Virgin Concrete' },
      object: { uuid: 'building-old2-uuid', name: 'Old Factory' },
      quantity: 18000,
      unit: 'kg',
      processName: 'Factory Construction (1978)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 360,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 1,
      qualityChangeCode: 'SAME',
      notes: 'Heavy-duty industrial foundation',
    },

    // === DECONSTRUCTION PHASE (Stage 3.5 → 2.0) ===
    
    // Office building deconstruction
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-a-uuid', name: 'Building A (Office)' },
      object: { uuid: 'reclaimed-brick-a-uuid', name: 'Reclaimed Brick (from Office)' },
      quantity: 4950,
      unit: 'kg',
      processName: 'Office Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 45,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 3,
      qualityChangeCode: 'SAME',
      notes: 'Careful brick removal for reuse',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-a-uuid', name: 'Building A (Office)' },
      object: { uuid: 'reclaimed-steel-a-uuid', name: 'Reclaimed Steel (from Office)' },
      quantity: 2200,
      unit: 'kg',
      processName: 'Office Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 25,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 2,
      qualityChangeCode: 'SAME',
      notes: 'Steel beams in excellent condition',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-a-uuid', name: 'Building A (Office)' },
      object: { uuid: 'concrete-waste-mixed-uuid', name: 'Mixed Concrete Waste' },
      quantity: 21780,
      unit: 'kg',
      processName: 'Office Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 12,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Concrete requires crushing for recycling',
    },

    // Warehouse deconstruction
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-old1-uuid', name: 'Old Warehouse' },
      object: { uuid: 'reclaimed-steel-warehouse-uuid', name: 'Reclaimed Steel (from Warehouse)' },
      quantity: 7600,
      unit: 'kg',
      processName: 'Warehouse Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 85,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 5,
      qualityChangeCode: 'SAME',
      notes: 'Heavy steel beams suitable for reuse',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-old1-uuid', name: 'Old Warehouse' },
      object: { uuid: 'concrete-waste-mixed-uuid', name: 'Mixed Concrete Waste' },
      quantity: 34650,
      unit: 'kg',
      processName: 'Warehouse Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 18,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Large volume concrete for recycling',
    },

    // Factory deconstruction
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-old2-uuid', name: 'Old Factory' },
      object: { uuid: 'reclaimed-rebar-factory-uuid', name: 'Reclaimed Rebar (from Factory)' },
      quantity: 1140,
      unit: 'kg',
      processName: 'Factory Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 15,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 5,
      qualityChangeCode: 'SAME',
      notes: 'Rebar extracted from reinforced concrete',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-old2-uuid', name: 'Old Factory' },
      object: { uuid: 'concrete-waste-mixed-uuid', name: 'Mixed Concrete Waste' },
      quantity: 17820,
      unit: 'kg',
      processName: 'Factory Deconstruction (2024)',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 10,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Industrial concrete for aggregate production',
    },

    // === RECYCLING PHASE (Stage 2.0 → 0.2) ===
    
    // Concrete recycling (mixed waste from all buildings)
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'concrete-waste-mixed-uuid', name: 'Mixed Concrete Waste' },
      object: { uuid: 'recycled-aggregate-uuid', name: 'Recycled Aggregate' },
      quantity: 59400,
      unit: 'kg',
      processName: 'Concrete Crushing & Sorting',
      processTypeCode: 'RECYCLING',
      flowCategory: 'DOWNCYCLING',
      emissionsTotal: 890,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 20,
      qualityChangeCode: 'DOWN',
      notes: 'Large-scale concrete recycling facility',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'concrete-waste-mixed-uuid', name: 'Mixed Concrete Waste' },
      object: { uuid: 'landfill-uuid', name: 'Landfill' },
      quantity: 14850,
      unit: 'kg',
      processName: 'Concrete Crushing & Sorting',
      processTypeCode: 'RECYCLING',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 25,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 100,
      notes: 'Contaminated concrete and fine particles',
    },

    // Some steel recycling (damaged pieces)
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-steel-warehouse-uuid', name: 'Reclaimed Steel (from Warehouse)' },
      object: { uuid: 'recycled-steel-uuid', name: 'Recycled Steel' },
      quantity: 1520,
      unit: 'kg',
      processName: 'Steel Remelting',
      processTypeCode: 'RECYCLING',
      flowCategory: 'RECYCLING',
      emissionsTotal: 456,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 8,
      qualityChangeCode: 'SAME',
      notes: 'Damaged beams remelted into new steel',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-steel-warehouse-uuid', name: 'Reclaimed Steel (from Warehouse)' },
      object: { uuid: 'steel-scrap-uuid', name: 'Steel Scrap (unusable)' },
      quantity: 380,
      unit: 'kg',
      processName: 'Steel Remelting',
      processTypeCode: 'RECYCLING',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 5,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 100,
      notes: 'Heavily corroded steel sent to scrap',
    },

    // === NEW CONSTRUCTION PHASE (Stage 0.2-2.0 → 3.5) ===
    
    // Residential Complex construction (uses materials from multiple sources)
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-brick-a-uuid', name: 'Reclaimed Brick (from Office)' },
      object: { uuid: 'building-b-uuid', name: 'New Residential Complex' },
      quantity: 4950,
      unit: 'kg',
      processName: 'Residential Complex Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 25,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Reclaimed brick for residential facade',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-steel-warehouse-uuid', name: 'Reclaimed Steel (from Warehouse)' },
      object: { uuid: 'building-b-uuid', name: 'New Residential Complex' },
      quantity: 5700,
      unit: 'kg',
      processName: 'Residential Complex Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 28,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Heavy steel beams for residential structure',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'recycled-aggregate-uuid', name: 'Recycled Aggregate' },
      object: { uuid: 'building-b-uuid', name: 'New Residential Complex' },
      quantity: 35000,
      unit: 'kg',
      processName: 'Residential Complex Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'RECYCLING',
      emissionsTotal: 175,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Recycled aggregate in new concrete',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-cement-uuid', name: 'Virgin Cement' },
      object: { uuid: 'building-b-uuid', name: 'New Residential Complex' },
      quantity: 8750,
      unit: 'kg',
      processName: 'Residential Complex Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 1312,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Virgin cement for binding recycled aggregate',
    },

    // Community Center construction (different material mix)
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-steel-a-uuid', name: 'Reclaimed Steel (from Office)' },
      object: { uuid: 'building-c-uuid', name: 'New Community Center' },
      quantity: 2200,
      unit: 'kg',
      processName: 'Community Center Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 11,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Office steel beams for community center frame',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-rebar-factory-uuid', name: 'Reclaimed Rebar (from Factory)' },
      object: { uuid: 'building-c-uuid', name: 'New Community Center' },
      quantity: 1140,
      unit: 'kg',
      processName: 'Community Center Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 6,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Factory rebar for reinforced concrete',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'recycled-aggregate-uuid', name: 'Recycled Aggregate' },
      object: { uuid: 'building-c-uuid', name: 'New Community Center' },
      quantity: 24400,
      unit: 'kg',
      processName: 'Community Center Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'RECYCLING',
      emissionsTotal: 122,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Recycled aggregate for foundation',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'recycled-steel-uuid', name: 'Recycled Steel' },
      object: { uuid: 'building-c-uuid', name: 'New Community Center' },
      quantity: 1520,
      unit: 'kg',
      processName: 'Community Center Construction (2024)',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'RECYCLING',
      emissionsTotal: 76,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Recycled steel for secondary structure',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-a-uuid', name: 'Building A' },
      object: { uuid: 'reclaimed-brick-uuid', name: 'Reclaimed Brick' },
      quantity: 5000,
      unit: 'kg',
      processName: 'Deconstruction of Building A',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 45,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 5,
      qualityChangeCode: 'SAME',
      notes: 'Careful deconstruction preserves brick quality',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-a-uuid', name: 'Building A' },
      object: { uuid: 'reclaimed-steel-uuid', name: 'Reclaimed Steel Beam' },
      quantity: 2000,
      unit: 'kg',
      processName: 'Deconstruction of Building A',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 25,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 2,
      qualityChangeCode: 'SAME',
      notes: 'Steel beams in excellent condition for reuse',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'building-a-uuid', name: 'Building A' },
      object: { uuid: 'concrete-waste-uuid', name: 'Concrete Waste' },
      quantity: 15000,
      unit: 'kg',
      processName: 'Deconstruction of Building A',
      processTypeCode: 'DECONSTRUCTION',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 12,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Concrete requires crushing for recycling',
    },

    // Recycling of concrete waste
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'concrete-waste-uuid', name: 'Concrete Waste' },
      object: { uuid: 'recycled-aggregate-uuid', name: 'Recycled Aggregate' },
      quantity: 12000,
      unit: 'kg',
      processName: 'Concrete Crushing & Sorting',
      processTypeCode: 'RECYCLING',
      flowCategory: 'DOWNCYCLING',
      emissionsTotal: 180,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 20,
      qualityChangeCode: 'DOWN',
      notes: 'Crushing reduces concrete to aggregate, losing structural properties',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'concrete-waste-uuid', name: 'Concrete Waste' },
      object: { uuid: 'landfill-uuid', name: 'Landfill' },
      quantity: 3000,
      unit: 'kg',
      processName: 'Concrete Crushing & Sorting',
      processTypeCode: 'RECYCLING',
      flowCategory: 'WASTE_FLOW',
      emissionsTotal: 5,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 100,
      notes: 'Fine particles and contaminated concrete sent to landfill',
    },

    // Construction of Building B
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-brick-uuid', name: 'Reclaimed Brick' },
      object: { uuid: 'building-b-uuid', name: 'Building B' },
      quantity: 4750,
      unit: 'kg',
      processName: 'Construction of Building B',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 15,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Direct reuse of reclaimed bricks in new facade',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'reclaimed-steel-uuid', name: 'Reclaimed Steel Beam' },
      object: { uuid: 'building-b-uuid', name: 'Building B' },
      quantity: 1960,
      unit: 'kg',
      processName: 'Construction of Building B',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'REUSE',
      emissionsTotal: 8,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      qualityChangeCode: 'SAME',
      notes: 'Reclaimed steel beams used in structural framework',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'recycled-aggregate-uuid', name: 'Recycled Aggregate' },
      object: { uuid: 'building-b-uuid', name: 'Building B' },
      quantity: 12000,
      unit: 'kg',
      processName: 'Construction of Building B',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'RECYCLING',
      emissionsTotal: 35,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Recycled aggregate used in new concrete foundation',
    },
    {
      predicate: 'IS_INPUT_OF',
      subject: { uuid: 'virgin-cement-uuid', name: 'Virgin Cement' },
      object: { uuid: 'building-b-uuid', name: 'Building B' },
      quantity: 3000,
      unit: 'kg',
      processName: 'Construction of Building B',
      processTypeCode: 'CONSTRUCTION',
      flowCategory: 'STANDARD',
      emissionsTotal: 450,
      emissionsUnit: 'kgCO2e',
      materialLossPercent: 0,
      notes: 'Virgin cement needed for binding recycled aggregate',
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Enhanced Sankey Diagram Demo</h1>
        <p className="text-gray-600">
          Material lifecycle visualization with emissions and reuse tracking
        </p>
      </div>

      {/* Demo Description */}
      <Card>
        <CardHeader>
          <CardTitle>Complex Circular Construction Network: Multiple Buildings → Recycling → New Buildings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            This demo shows a realistic circular economy scenario: raw materials are processed into building materials, 
            used in multiple buildings over decades, then deconstructed and materials flow into multiple new buildings. 
            It demonstrates complex many-to-many material flows typical of urban construction networks.
          </p>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Create Real Processes:</strong> Go to the <a href="/processes" className="underline font-medium hover:text-blue-900">Processes page</a> to create your own material flows using the enhanced metadata fields demonstrated here. The process creation form now includes lifecycle stages, flow categories, emissions data, and custom properties.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-purple-700">🏭 Raw Materials</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Clay → Brick (1,200 kgCO2e)</li>
                <li>• Iron Ore → Steel (6,750 kgCO2e)</li>
                <li>• Limestone + Water + Stone → Concrete (1,730 kgCO2e)</li>
                <li><strong>Processing: 9,680 kgCO2e</strong></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-indigo-700">🏗️ Original Construction</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Office Building (807 kgCO2e)</li>
                <li>• Warehouse (1,100 kgCO2e)</li>
                <li>• Factory (420 kgCO2e)</li>
                <li><strong>3 Buildings: 2,327 kgCO2e</strong></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-blue-700">🔨 Deconstruction</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 3 Buildings → Reclaimed Materials</li>
                <li>• Brick: 3% loss</li>
                <li>• Steel: 2-5% loss</li>
                <li>• Concrete → Waste stream</li>
                <li><strong>Total: 195 kgCO2e</strong></li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-green-700">♻️ Recycling</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 74,250 kg concrete → 59,400 kg aggregate</li>
                <li>• 1,520 kg steel → recycled steel</li>
                <li>• 20% material loss in recycling</li>
                <li><strong>Total: 1,376 kgCO2e</strong></li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-emerald-700">🏢 New Construction</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Residential Complex (1,540 kgCO2e)</li>
                <li>• Community Center (215 kgCO2e)</li>
                <li>• 80% reclaimed/recycled materials</li>
                <li>• 20% virgin cement (binding)</li>
                <li><strong>2 Buildings: 1,755 kgCO2e</strong></li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Hover over flows</strong> to see emissions data, material losses, and quality changes. 
                Click flows to select them and see detailed information.
              </p>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <h5 className="text-sm font-semibold text-green-800 mb-1">🌍 Circular Economy Impact</h5>
              <div className="text-xs text-green-700 space-y-1">
                <div><strong>Virgin approach (3 buildings):</strong> 12,007 kgCO2e</div>
                <div><strong>Circular approach (2 buildings):</strong> 3,326 kgCO2e</div>
                <div><strong>Material recovery rate:</strong> 80%</div>
                <div className="font-semibold text-green-800">
                  <strong>Net savings: 8,681 kgCO2e (72% reduction)</strong>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualization Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="sankey" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sankey">Sankey Flow Diagram</TabsTrigger>
              <TabsTrigger value="network">Network Relationship Diagram</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sankey" className="mt-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Material Flow Visualization</h3>
                  <p className="text-sm text-gray-600">
                    Shows the sequential flow of materials through lifecycle stages with emissions and loss data
                  </p>
                </div>
                <SankeyDiagram
                  materials={sampleMaterials}
                  relationships={sampleRelationships}
                  selectedRelationship={selectedRelationship}
                  onLinkSelect={setSelectedRelationship}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="network" className="mt-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Building-Centric Network Visualization</h3>
                  <p className="text-sm text-gray-600">
                    Shows buildings as central hubs with materials flowing out to recycling facilities, other buildings, or waste. 
                    Drag nodes to rearrange the layout and explore material pathways.
                  </p>
                </div>
                <NetworkDiagram
                  materials={sampleMaterials}
                  relationships={sampleRelationships}
                  selectedRelationship={selectedRelationship}
                  onLinkSelect={setSelectedRelationship}
                  onNodeSelect={setSelectedMaterial}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Selected Material Details */}
      {selectedMaterial && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Material Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">Material Information</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Name:</strong> {selectedMaterial.name}</div>
                  <div><strong>Type:</strong> {selectedMaterial.type}</div>
                  {selectedMaterial.lifecycleStage && (
                    <div><strong>Lifecycle Stage:</strong> {selectedMaterial.lifecycleStage.replace('_', ' ')}</div>
                  )}
                  {selectedMaterial.domainCategoryCode && (
                    <div><strong>Category:</strong> {selectedMaterial.domainCategoryCode}</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold">Circular Economy Properties</h4>
                <div className="space-y-2 text-sm">
                  {selectedMaterial.isReusedComponent && (
                    <div className="text-cyan-700"><strong>🔄 Reused Component</strong></div>
                  )}
                  {selectedMaterial.isRecyclingMaterial && (
                    <div className="text-green-700"><strong>♻️ Recycled Material</strong></div>
                  )}
                  {selectedMaterial.sourceBuildingUuid && (
                    <div><strong>Source Building:</strong> {selectedMaterial.sourceBuildingUuid.slice(-8)}</div>
                  )}
                  {selectedMaterial.targetBuildingUuid && (
                    <div><strong>Target Building:</strong> {selectedMaterial.targetBuildingUuid.slice(-8)}</div>
                  )}
                  {!selectedMaterial.isReusedComponent && !selectedMaterial.isRecyclingMaterial && (
                    <div className="text-gray-600">Virgin material</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedMaterial(null)}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Relationship Details */}
      {selectedRelationship && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Flow Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">Flow Information</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>From:</strong> {selectedRelationship.subject.name}</div>
                  <div><strong>To:</strong> {selectedRelationship.object.name}</div>
                  <div><strong>Process:</strong> {selectedRelationship.processName}</div>
                  <div><strong>Quantity:</strong> {selectedRelationship.quantity?.toLocaleString()} {selectedRelationship.unit}</div>
                  <div><strong>Flow Type:</strong> {selectedRelationship.flowCategory?.replace('_', ' ')}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold">Environmental Impact</h4>
                <div className="space-y-2 text-sm">
                  {selectedRelationship.emissionsTotal && (
                    <div><strong>🌍 Emissions:</strong> {selectedRelationship.emissionsTotal} {selectedRelationship.emissionsUnit}</div>
                  )}
                  {selectedRelationship.materialLossPercent !== undefined && (
                    <div><strong>⚠️ Material Loss:</strong> {selectedRelationship.materialLossPercent}%</div>
                  )}
                  {selectedRelationship.qualityChangeCode && (
                    <div><strong>Quality Change:</strong> 
                      {selectedRelationship.qualityChangeCode === 'UP' ? ' ⬆️ Upcycled' : 
                       selectedRelationship.qualityChangeCode === 'DOWN' ? ' ⬇️ Downcycled' : 
                       ' ➡️ Same Quality'}
                    </div>
                  )}
                  {selectedRelationship.notes && (
                    <div><strong>Notes:</strong> {selectedRelationship.notes}</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedRelationship(null)}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Implementation Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">✅ What's Implemented</h4>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Metadata-driven layout (no name-based heuristics)</li>
              <li>• Lifecycle stage visualization with proper colors</li>
              <li>• Flow category styling (recycling, reuse, downcycling, waste)</li>
              <li>• Emissions and material loss data on hover</li>
              <li>• Enhanced tooltips with impact information</li>
              <li>• Reused component highlighting (dashed cyan borders)</li>
              <li>• Recycled material indicators (dashed green borders)</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">🚧 Next Steps</h4>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Integrate with enhanced process creation forms</li>
              <li>• Connect to real statement properties from API</li>
              <li>• Add building-to-building flow filtering</li>
              <li>• Implement configuration for domain-specific tweaks</li>
              <li>• Add export functionality for impact reports</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

