import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import {
  ENABLED_OBJECT_VIEW_TYPES,
  ENABLED_PROCESS_VIEW_TYPES,
} from '@/constants/view-types'
import { NAV_ITEMS } from '@/constants/site'
import { SOCIAL_PROVIDERS } from '@/constants/auth'

type Tree = Record<string, unknown>

const flatten = (o: Tree, prefix: string[] = []): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? flatten(v as Tree, [...prefix, k])
      : [[...prefix, k].join('.')]
  )

const at = (o: Tree, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (acc, k) =>
        acc == null || typeof acc !== 'object' ? undefined : (acc as Tree)[k],
      o
    )

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        if (entry !== 'messages' && entry !== '__tests__') walk(p)
      } else if (/\.tsx?$/.test(entry)) out.push(p)
    }
  }
  walk('src')
  return out
}

interface Usage {
  /** `ns.key` for every call with a string literal — must resolve to a leaf. */
  literals: string[]
  /** Namespaces reached with a NON-literal argument — must survive whole. */
  dynamicNamespaces: Set<string>
}

/**
 * Every translation call in the source, by binding name.
 *
 * Bindings are collected by NAME rather than assuming `t`: `const tOpt =
 * useTranslations('settings.preferences.options')` is real, and a checker anchored on `t(` walks
 * straight past it.
 */
function collectUsage(): Usage {
  const literals: string[] = []
  const dynamicNamespaces = new Set<string>()

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8')

    const bindings = new Map<string, string>()
    for (const m of source.matchAll(
      /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g
    )) {
      bindings.set(m[1], m[2] ?? '')
    }

    for (const [name, ns] of bindings) {
      const call = new RegExp(
        `\\b${name}(?:\\.(?:rich|raw|markup))?\\(\\s*([^)]*)`,
        'g'
      )
      for (const m of source.matchAll(call)) {
        const arg = m[1].trim()
        if (!arg) continue

        const literal = arg.match(/^(['"])([^'"]+)\1/)
        if (literal) {
          literals.push(ns ? `${ns}.${literal[2]}` : literal[2])
          continue
        }

        // `t(`a.b.${x}`)` — the stem is the namespace that must survive.
        const template = arg.match(/^`([^`$]*)\$\{/)
        if (template) {
          const stem = template[1].replace(/\.$/, '')
          const full = ns ? (stem ? `${ns}.${stem}` : ns) : stem
          if (full) dynamicNamespaces.add(full)
          continue
        }

        // A variable or a call — the key is chosen at runtime, so the whole namespace is reachable.
        if (ns) dynamicNamespaces.add(ns)
      }
    }
  }

  return { literals, dynamicNamespaces }
}

/**
 * The message files are the one place TypeScript cannot help: a key is a string, so a deleted or
 * renamed one fails at render, on whichever screen nobody opened.
 *
 * Written after a prune of ~540 keys removed five that a constant enumerated at runtime.
 */
describe('messages', () => {
  /**
   * next-intl reserves `.` for nesting, so a key containing one is REFUSED — and not quietly:
   * `NextIntlClientProvider` throws `INVALID_KEY` while constructing, so the whole app fails to
   * render, not just the screen that reads it.
   *
   * This is checked separately from "does every key resolve" because the two catch different
   * things. The resolver test only sees keys written as literals; the offender here was built as
   * `t(\`import.map.targets.${option}\`)` where `option` was `address.street`, so the collector
   * skipped it as dynamic and the message file looked fine to every gate. The file's SHAPE has to
   * be checked on its own terms.
   */
  it('has no key containing a dot, in either locale', () => {
    const dotted = (tree: Tree, path: string[] = []): string[] =>
      Object.entries(tree).flatMap(([key, value]) => [
        ...(key.includes('.') ? [[...path, key].join(' → ')] : []),
        ...(value && typeof value === 'object'
          ? dotted(value as Tree, [...path, key])
          : []),
      ])

    expect(dotted(en as Tree)).toEqual([])
    expect(dotted(nl as Tree)).toEqual([])
  })

  it('has the same keys in en and nl', () => {
    const e = flatten(en as Tree)
    const n = flatten(nl as Tree)
    // Locale files drift one key at a time, and nothing complains until a Dutch user finds it.
    expect(e.filter((k) => !n.includes(k))).toEqual([])
    expect(n.filter((k) => !e.includes(k))).toEqual([])
  })

  it('resolves every key passed to a translator as a literal', () => {
    const { literals } = collectUsage()
    const unresolved = literals.filter((k) => at(en as Tree, k) === undefined)
    expect(unresolved).toEqual([])
  })

  it('keeps every dynamically-reached namespace populated', () => {
    // `tOpt(v.value)` over a constant, or `t.raw('help.windowsSteps')` reading an array, names no
    // key a scan can see, so nothing inside such a namespace may be pruned on "no reference".
    //
    // LIMIT: this can only assert the namespace still EXISTS, not that it holds the right members —
    // no static check knows what a runtime constant enumerates. Where the constant is typed, assert
    // it directly, as the view-type test below does.
    const { dynamicNamespaces } = collectUsage()
    expect(dynamicNamespaces.size).toBeGreaterThan(0)

    const empty = [...dynamicNamespaces].filter((ns) => {
      const node = at(en as Tree, ns)
      return !node || typeof node !== 'object' || Object.keys(node).length === 0
    })
    expect(empty).toEqual([])
  })

  // The settings page labels each view with `tOpt(v.value)`, so a missing member is a hard render
  // error there and nowhere else. These constants are typed, so the check is exact.
  it.each([
    ['object', ENABLED_OBJECT_VIEW_TYPES],
    ['process', ENABLED_PROCESS_VIEW_TYPES],
  ])('labels every enabled %s view type', (_kind, types) => {
    for (const type of types) {
      expect(
        at(en as Tree, `settings.preferences.options.${type.value}`)
      ).toBeTypeOf('string')
      expect(
        at(nl as Tree, `settings.preferences.options.${type.value}`)
      ).toBeTypeOf('string')
    }
  })

  // The login page renders `auth.social.${labelKey}`, which the dynamic-namespace check can only
  // prove is non-empty. A deployer enabling a provider whose label was pruned gets a blank button.
  it('labels every social sign-in provider', () => {
    for (const provider of SOCIAL_PROVIDERS) {
      expect(at(en as Tree, `auth.social.${provider.labelKey}`)).toBeTypeOf(
        'string'
      )
      expect(at(nl as Tree, `auth.social.${provider.labelKey}`)).toBeTypeOf(
        'string'
      )
    }
  })

  // The navbar renders `nav.${item.key}`, so a nav key with no message throws at RENDER — the whole
  // layout, not just the label. Nothing else compares the two lists, so a kebab-case key sitting
  // beside a camelCase message resolved to nothing until someone opened the menu.
  it('has a label for every navigation item, at both levels', () => {
    for (const item of NAV_ITEMS) {
      expect(at(en as Tree, `nav.${item.key}`)).toBeTypeOf('string')
      expect(at(nl as Tree, `nav.${item.key}`)).toBeTypeOf('string')
      for (const child of item.children ?? []) {
        expect(at(en as Tree, `nav.${child.key}`)).toBeTypeOf('string')
        expect(at(nl as Tree, `nav.${child.key}`)).toBeTypeOf('string')
      }
    }
  })
})
