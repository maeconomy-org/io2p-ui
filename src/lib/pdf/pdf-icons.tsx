/**
 * Passport-PDF icon set — Lucide path data rendered via @react-pdf SVG
 * primitives so icons match the screen passport exactly without needing a
 * font or raster images.
 *
 * All Lucide icons share: viewBox="0 0 24 24", stroke=color, fill="none",
 * strokeWidth={2}, strokeLinecap="round", strokeLinejoin="round".
 */

import { Circle, Line, Path, Polyline, Rect, Svg } from '@react-pdf/renderer'

interface PdfIconProps {
  size?: number
  color?: string
}

const STROKE_PROPS = (color: string) => ({
  stroke: color,
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function IdCardIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M16 10h2" {...s} />
      <Path d="M16 14h2" {...s} />
      <Path d="M6.17 15a3 3 0 0 1 5.66 0" {...s} />
      <Circle cx="9" cy="11" r="2" {...s} />
      <Rect x="2" y="5" width="20" height="14" rx="2" {...s} />
    </Svg>
  )
}

export function CalendarIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M8 2v4" {...s} />
      <Path d="M16 2v4" {...s} />
      <Rect width="18" height="18" x="3" y="4" rx="2" {...s} />
      <Path d="M3 10h18" {...s} />
    </Svg>
  )
}

export function PackageIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"
        {...s}
      />
      <Path d="M12 22V12" {...s} />
      <Polyline points="3.29 7 12 12 20.71 7" {...s} />
      <Path d="m7.5 4.27 9 5.15" {...s} />
    </Svg>
  )
}

export function CircleCheckIcon({
  size = 12,
  color = '#6b7280',
}: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="10" {...s} />
      <Path d="m9 12 2 2 4-4" {...s} />
    </Svg>
  )
}

export function WrenchIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"
        {...s}
      />
    </Svg>
  )
}

export function HourglassIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M5 22h14" {...s} />
      <Path d="M5 2h14" {...s} />
      <Path
        d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"
        {...s}
      />
      <Path
        d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"
        {...s}
      />
    </Svg>
  )
}

export function MapPinIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        {...s}
      />
      <Circle cx="12" cy="10" r="3" {...s} />
    </Svg>
  )
}

export function FileTextIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        {...s}
      />
      <Path d="M14 2v5a1 1 0 0 0 1 1h5" {...s} />
      <Path d="M10 9H8" {...s} />
      <Path d="M16 13H8" {...s} />
      <Path d="M16 17H8" {...s} />
    </Svg>
  )
}

export function ImageIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect width="18" height="18" x="3" y="3" rx="2" ry="2" {...s} />
      <Circle cx="9" cy="9" r="2" {...s} />
      <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" {...s} />
    </Svg>
  )
}

export function ShieldCheckIcon({
  size = 12,
  color = '#6b7280',
}: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        {...s}
      />
      <Path d="m9 12 2 2 4-4" {...s} />
    </Svg>
  )
}

export function TagIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
        {...s}
      />
      <Circle cx="7.5" cy="7.5" r=".5" fill={color} stroke={color} />
    </Svg>
  )
}

export function UserIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" {...s} />
      <Circle cx="12" cy="7" r="4" {...s} />
    </Svg>
  )
}

export function LeafIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"
        {...s}
      />
      <Path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" {...s} />
    </Svg>
  )
}

export function ShoppingCartIcon({
  size = 12,
  color = '#6b7280',
}: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="8" cy="21" r="1" {...s} />
      <Circle cx="19" cy="21" r="1" {...s} />
      <Path
        d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
        {...s}
      />
    </Svg>
  )
}

export function RulerIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0z"
        {...s}
      />
      <Path d="m14.5 12.5 2-2" {...s} />
      <Path d="m11.5 9.5 2-2" {...s} />
      <Path d="m8.5 6.5 2-2" {...s} />
      <Path d="m17.5 15.5 2-2" {...s} />
    </Svg>
  )
}

export function PaletteIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="13.5" cy="6.5" r=".5" fill={color} stroke={color} />
      <Circle cx="17.5" cy="10.5" r=".5" fill={color} stroke={color} />
      <Circle cx="8.5" cy="7.5" r=".5" fill={color} stroke={color} />
      <Circle cx="6.5" cy="12.5" r=".5" fill={color} stroke={color} />
      <Path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
        {...s}
      />
    </Svg>
  )
}

export function BoxIcon({ size = 12, color = '#6b7280' }: PdfIconProps) {
  const s = STROKE_PROPS(color)
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        {...s}
      />
      <Path d="m3.3 7 8.7 5 8.7-5" {...s} />
      <Path d="M12 22V12" {...s} />
    </Svg>
  )
}

/** Map from PASSPORT_CATEGORY_ORDER keys to the relevant icon component. */
export const CATEGORY_ICONS: Record<
  string,
  (props: PdfIconProps) => React.ReactElement
> = {
  product: PackageIcon,
  classification: TagIcon,
  dimensions: RulerIcon,
  composition: BoxIcon,
  appearance: PaletteIcon,
  sustainability: LeafIcon,
  commerce: ShoppingCartIcon,
  ownership: UserIcon,
  state: ShieldCheckIcon,
  contact: UserIcon,
  location: MapPinIcon,
  meta: FileTextIcon,
  other: FileTextIcon,
}

// React is needed for JSX in this file even though it's not explicitly imported
import React from 'react'
