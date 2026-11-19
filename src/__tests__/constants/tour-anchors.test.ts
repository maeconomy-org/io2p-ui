import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { TOUR_ANCHORS, anchor, sel } from '@/constants'
import { TOURS } from '@/components/onboarding/tour-registry'
import type { TourMessages } from '@/components/onboarding/tour-messages'
import mainEn from '@/messages/en.json'
import en from '@/messages/onboarding/en.json'
import nl from '@/messages/onboarding/nl.json'

/**
 * The check whose absence caused the dead-anchor bug.
 *
 * Eight of eleven demo steps pointed at `data-tour` values the refactor had
 * deleted, and nothing failed — not the compiler, not a test, not the runtime.
 * These assertions make the registry the single source of truth and fail if a
 * name is declared without a home in the app, or rendered without a declaration.
 */

const SRC = join(process.cwd(), 'src')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : walk(full)
    }
    return /\.tsx?$/.test(entry) ? [full] : []
  })

const sources = walk(SRC).map((f) => ({
  file: f,
  text: readFileSync(f, 'utf8'),
}))

const scan = (pattern: RegExp) => {
  const found = new Set<string>()
  for (const { text } of sources) {
    for (const match of text.matchAll(pattern)) found.add(match[1])
  }
  return found
}

/** Anchor names referenced through the helpers, anywhere in the app. */
const referenced = (helper: 'anchor' | 'sel') =>
  scan(new RegExp(`\\b${helper}\\('([a-zA-Z]+)'\\)`, 'g'))

/**
 * Names that reach the DOM. Two legitimate routes: `anchor()` spread at a call
 * site, and `TOUR_ANCHORS.x` handed to a renderer that spreads it itself — which
 * is how the nav items in `site.ts` carry theirs.
 */
const rendered = () =>
  new Set([...referenced('anchor'), ...scan(/TOUR_ANCHORS\.([a-zA-Z]+)/g)])

describe('tour anchor registry', () => {
  it('produces a data-tour prop and a matching selector', () => {
    expect(anchor('navObjects')).toEqual({ 'data-tour': 'nav-objects' })
    expect(sel('navObjects')).toBe('[data-tour="nav-objects"]')
  })

  it('has no duplicate anchor values', () => {
    const values = Object.values(TOUR_ANCHORS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('every anchor a tour targets is rendered somewhere', () => {
    const inDom = rendered()
    const orphans = [...referenced('sel')].filter((name) => !inDom.has(name))

    expect(orphans, `tour steps target unrendered anchors: ${orphans}`).toEqual(
      []
    )
  })

  it('every name used through the helpers is declared in the registry', () => {
    const used = new Set([...rendered(), ...referenced('sel')])
    const undeclared = [...used].filter((name) => !(name in TOUR_ANCHORS))
    expect(undeclared).toEqual([])
  })

  it('no literal data-tour attributes bypass the registry', () => {
    // A literal is invisible to every check above, which is exactly how the
    // original drift went unnoticed.
    const offenders = sources
      .filter(
        ({ file, text }) =>
          /data-tour="/.test(text) && !file.endsWith('tour-anchors.ts')
      )
      .map(({ file }) => file.replace(`${process.cwd()}/`, ''))

    expect(offenders).toEqual([])
  })
})

describe('tour copy', () => {
  const keysOf = (bundle: Record<string, Record<string, string>>) =>
    Object.entries(bundle).flatMap(([group, entries]) =>
      Object.keys(entries).map((key) => `${group}.${key}`)
    )

  it('en and nl declare exactly the same keys', () => {
    expect(keysOf(nl).sort()).toEqual(keysOf(en).sort())
  })

  it('has copy for every step the initial-login tour renders', () => {
    const tour = readFileSync(
      join(SRC, 'components/onboarding/initial-login-tour.tsx'),
      'utf8'
    )
    const used = [
      ...tour.matchAll(/tourText\(m, 'initialLogin', '(\w+)'\)/g),
    ].map((m) => m[1])

    expect(used.length).toBeGreaterThan(0)
    for (const key of used) {
      expect(en.initialLogin, `missing en copy: ${key}`).toHaveProperty(key)
      expect(nl.initialLogin, `missing nl copy: ${key}`).toHaveProperty(key)
    }
  })

  it('has copy for every step every registered tour renders', () => {
    for (const tour of TOURS) {
      const steps = tour.steps(en as unknown as TourMessages)
      expect(steps.length, `${tour.id} has no steps`).toBeGreaterThan(0)

      for (const { popover } of steps) {
        // `tourText` falls back to "group.key" when a string is missing, so an
        // unresolved key is visible as a literal dotted path in the popover.
        expect(popover.title, `${tour.id}: missing copy`).not.toMatch(/^\w+\./)
        expect(popover.description, `${tour.id}: missing copy`).not.toMatch(
          /^\w+\./
        )
      }
    }
  })

  it('targets anchors that live under the tour’s own route', () => {
    // build-template pointed at `sheetProperties`, which existed only in the
    // OBJECT create form — the template sheet is a different component. The step
    // waited six seconds for something that could never appear on /templates.
    const ROUTE_DIRS: Record<string, string[]> = {
      '/objects': ['src/app/objects', 'src/components'],
      '/processes': ['src/app/processes', 'src/components'],
      '/templates': ['src/app/templates', 'src/components'],
      '/formulas': ['src/app/formulas', 'src/components'],
      '/shares': ['src/app/shares', 'src/components'],
      '/import': ['src/app/import', 'src/components'],
      '/constants': ['src/app/constants', 'src/components'],
      '/rollup-rules': ['src/app/rollup-rules', 'src/components'],
    }

    for (const tour of TOURS) {
      // Thrown rather than defaulted to []: an undeclared route used to scope the
      // scan to nothing, and every one of that tour's steps failed with a
      // misleading "nothing renders it" instead of the real cause.
      const dirs = ROUTE_DIRS[tour.route]
      if (!dirs) throw new Error(`no scope declared for ${tour.route}`)
      const scope = sources
        .filter(({ file }) =>
          dirs.some((dir) => file.startsWith(join(process.cwd(), dir)))
        )
        .map(({ text }) => text)
        .join('\n')

      for (const step of tour.steps(en as unknown as TourMessages)) {
        const name = Object.entries(TOUR_ANCHORS).find(
          ([, value]) => step.element === `[data-tour="${value}"]`
        )?.[0]
        expect(
          scope.includes(`anchor('${name}')`) ||
            scope.includes(`TOUR_ANCHORS.${name}`),
          `${tour.id} targets ${name}, which nothing under ${tour.route} renders`
        ).toBe(true)
      }
    }
  })

  it('registers a tour for every label in the profile submenu', () => {
    const labels = Object.keys(mainEn.onboarding.tours)
    expect(labels.sort()).toEqual(TOURS.map((tour) => tour.id).sort())
  })
})
