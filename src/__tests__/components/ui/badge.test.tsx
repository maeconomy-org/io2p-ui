import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import colors from 'tailwindcss/colors'

import {
  Badge,
  ENTITY_TONES,
  PERMISSION_TONES,
  badgeVariants,
} from '@/components/ui/badge'

// ── WCAG relative luminance, per the spec ──
function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg)
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

type Palette = Record<string, Record<string, string>>
const shade = (name: string, step: string) =>
  step === 'white'
    ? '#ffffff'
    : ((colors as unknown as Palette)[name] as Record<string, string>)[step]

/**
 * Pulled from the class list rather than restated, so the test reads the SHIPPED colours. Restating
 * them would let the two drift and still pass — the failure mode this whole file exists to prevent.
 */
function pairs(variant: string) {
  const classes = badgeVariants({ variant: variant as never })
  const read = (re: RegExp) => {
    const m = classes.match(re)
    return m ? shade(m[1], m[2]) : null
  }
  return {
    lightBg: read(/(?<!dark:)bg-(\w+)-(\d+)\b/) ?? '#ffffff',
    lightFg: read(/(?<!dark:)text-(\w+)-(\d+)\b/) ?? '#ffffff',
    darkBg: read(/dark:bg-(\w+)-(\d+)\b/),
    darkFg: read(/dark:text-(\w+)-(\d+)\b/),
  }
}

const AA = 4.5

describe('badge tones', () => {
  it.each([...PERMISSION_TONES, ...ENTITY_TONES])(
    '%s clears WCAG AA in light mode',
    (tone) => {
      const { lightFg, lightBg } = pairs(tone)
      expect(contrast(lightFg, lightBg)).toBeGreaterThanOrEqual(AA)
    }
  )

  it.each([...PERMISSION_TONES, ...ENTITY_TONES])(
    '%s clears WCAG AA in dark mode',
    (tone) => {
      const { darkBg, darkFg, lightFg, lightBg } = pairs(tone)
      // `admin` is solid and keeps white text in both modes, so it declares no dark text class.
      const fg = darkFg ?? lightFg
      const bg = darkBg ?? lightBg
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA)
    }
  )

  // Dark mode is where tinted palettes die — the project's own `--chart-1` measures 2.98:1 there.
  // The first `admin` attempt (white on blue-500) measured 3.68:1 and had to be replaced.
  it('every tone declares its own dark values rather than reusing the light ones', () => {
    const reusingLight = [...PERMISSION_TONES, ...ENTITY_TONES].filter(
      (tone) => !badgeVariants({ variant: tone as never }).includes('dark:')
    )
    expect(reusingLight).toEqual([])
  })

  /**
   * Colour TEMPERATURE, coolest first. The ordinal encoding is this axis — not hue identity — so
   * the ramp is asserted as a monotonic walk along it rather than as four fixed colour names.
   * A single hue deepening was tried first and its tinted rungs were nearly indistinguishable at
   * badge size.
   */
  const TEMPERATURE = ['slate', 'sky', 'teal', 'emerald', 'amber', 'rose']
  const hueOf = (tone: string) =>
    badgeVariants({ variant: tone as never }).match(/bg-(\w+)-/)?.[1] ?? ''

  it('walks the permission ladder cool → warm, one step at a time', () => {
    const rungs = PERMISSION_TONES.map(hueOf).map((h) => TEMPERATURE.indexOf(h))

    expect(rungs).not.toContain(-1) // every rung is on the scale
    expect(rungs).toEqual([...rungs].sort((a, b) => a - b))
    // Strictly increasing: two rungs at the same temperature would not read as a step.
    expect(new Set(rungs).size).toBe(PERMISSION_TONES.length)
  })

  it('gives every entity type its own hue, and none of the ramp hues', () => {
    // A type sharing a rung's hue could be misread as a permission level on a row showing both,
    // which /shares does.
    const rampHues = PERMISSION_TONES.map(hueOf)
    const typeHues = ENTITY_TONES.map(hueOf)

    expect(new Set(typeHues).size).toBe(ENTITY_TONES.length)
    expect(typeHues.filter((h) => rampHues.includes(h))).toEqual([])
  })
})

describe('Badge', () => {
  it('is button-cornered, not a pill', () => {
    render(<Badge>Live</Badge>)
    expect(screen.getByText('Live')).toHaveClass('rounded-md')
    expect(screen.getByText('Live')).not.toHaveClass('rounded-full')
  })

  it('still renders the neutral variants unchanged', () => {
    render(<Badge variant="secondary">Neutral</Badge>)
    expect(screen.getByText('Neutral')).toHaveClass('bg-secondary')
  })
})

describe('the ramp against the neutral variants', () => {
  // `--secondary` (0 0% 96.1%) and slate-50 measure 1.04:1 against each other — the same lightness.
  // In the permission column a neutral chip sits beside `read`, so the rung has to be told apart by
  // something other than fill.
  it('gives read a visible border where every neutral variant has none', () => {
    expect(badgeVariants({ variant: 'read' })).toMatch(/border-slate-\d+/)

    for (const neutral of ['default', 'secondary', 'destructive'] as const) {
      expect(badgeVariants({ variant: neutral })).toContain(
        'border-transparent'
      )
    }
  })
})
