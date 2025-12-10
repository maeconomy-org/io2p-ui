import { Table, Columns, BarChart3, Network, LayoutDashboard } from 'lucide-react'

// Object view types configuration
export const OBJECT_VIEW_TYPES = [
  {
    value: 'table',
    label: 'Table View',
    icon: Table,
    enabled: true,
  },
  {
    value: 'columns',
    label: 'Columns View',
    icon: Columns,
    enabled: true,
  },
] as const

// Process view types configuration
export const PROCESS_VIEW_TYPES = [
  {
    value: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    value: 'sankey',
    label: 'Sankey Diagram',
    icon: BarChart3,
    enabled: true,
  },
  {
    value: 'network',
    label: 'Network Diagram',
    icon: Network,
    enabled: true,
  },
  {
    value: 'table',
    label: 'Table View',
    icon: Table,
    enabled: true,
  },
] as const

// Extract enabled types for TypeScript
export const ENABLED_OBJECT_VIEW_TYPES = OBJECT_VIEW_TYPES.filter(
  (type) => type.enabled
)
export const ENABLED_PROCESS_VIEW_TYPES = PROCESS_VIEW_TYPES.filter(
  (type) => type.enabled
)

// Type definitions
export type ObjectViewType = (typeof ENABLED_OBJECT_VIEW_TYPES)[number]['value']
export type ProcessViewType =
  (typeof ENABLED_PROCESS_VIEW_TYPES)[number]['value']

// Helper functions
export const getObjectViewConfig = (value: ObjectViewType) =>
  ENABLED_OBJECT_VIEW_TYPES.find((type) => type.value === value)

export const getProcessViewConfig = (value: ProcessViewType) =>
  ENABLED_PROCESS_VIEW_TYPES.find((type) => type.value === value)
