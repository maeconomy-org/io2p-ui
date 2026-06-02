import type {
  EnhancedMaterialRelationship,
  MaterialData,
} from '@/types/sankey-metadata'

/** Raw value as entered ("0.1 t"), with a fallback for legacy quantity/unit. */
function sideDisplay(material?: MaterialData): string {
  if (material?.displayValue) return material.displayValue
  if (material?.quantity) {
    return `${material.quantity} ${material.unit ?? ''}`.trim()
  }
  return ''
}

/**
 * Shared, clean flow tooltip for the Sankey and Network views (rendered by ECharts as HTML).
 * Shows only what we know: the two endpoints, the process name, and each side's quantity
 * with its property label. No property dumps, no legacy impact fields.
 */
export function buildFlowTooltip(rel: EnhancedMaterialRelationship): string {
  const row = (side: string, color: string, material?: MaterialData) => {
    const value = sideDisplay(material)
    if (!value) return ''
    const label = material?.quantityLabel || 'Quantity'
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:5px;">
        <span style="display:flex;align-items:center;gap:6px;color:#6b7280;font-size:11px;">
          <span style="width:7px;height:7px;border-radius:9999px;background:${color};display:inline-block;"></span>${side} · ${label}
        </span>
        <span style="font-weight:600;font-size:12px;">${value}</span>
      </div>`
  }

  return `<div style="min-width:175px;">
      <div style="font-weight:600;font-size:13px;">${rel.subject.name} → ${rel.object.name}</div>
      ${
        rel.processName
          ? `<div style="font-size:11px;color:#6b7280;margin-top:1px;">${rel.processName}</div>`
          : ''
      }
      ${row('Input', '#3b82f6', rel.inputMaterial)}
      ${row('Output', '#10b981', rel.outputMaterial)}
    </div>`
}
