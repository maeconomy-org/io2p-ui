export * from './dashboard-view'
export * from './table-view'
// network-view and sankey-view are excluded from barrel export
// because they import echarts (~300KB). They are lazy-loaded via
// next/dynamic in the processes page instead.
