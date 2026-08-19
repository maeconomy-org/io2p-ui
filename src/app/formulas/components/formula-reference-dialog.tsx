'use client'

import { useTranslations } from 'next-intl'
import { FunctionSquare, Ban } from 'lucide-react'

import { builtinNames } from '@/lib/formula-expression'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  ScrollArea,
  Separator,
} from '@/components/ui'

interface FormulaReferenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const OPERATORS = [
  { symbol: '+', key: 'add' },
  { symbol: '-', key: 'subtract' },
  { symbol: '*', key: 'multiply' },
  { symbol: '/', key: 'divide' },
  { symbol: '%', key: 'modulo' },
  { symbol: '^', key: 'power' },
  { symbol: '+x', key: 'unaryPlus' },
  { symbol: '-x', key: 'unaryMinus' },
] as const

/**
 * How the parser's functions are GROUPED for reading. Membership only — the list of what exists
 * comes from `builtinNames()`, so a parser upgrade cannot leave this dialog claiming a function
 * that is gone (it listed `signum`, which does not exist; the name is `sign`) or hiding seventeen
 * that arrived. Anything ungrouped falls into `other`, which a test asserts stays non-empty-safe.
 */
const FUNCTION_GROUPS = [
  {
    key: 'trigonometric',
    fns: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2'],
  },
  {
    key: 'hyperbolic',
    fns: ['sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'],
  },
  {
    key: 'logarithmic',
    fns: ['log', 'ln', 'lg', 'log2', 'log10', 'log1p', 'exp', 'expm1'],
  },
  { key: 'rounding', fns: ['ceil', 'floor', 'round', 'roundTo', 'trunc'] },
  {
    key: 'conditional',
    fns: ['if', 'not', 'min', 'max'],
  },
] as const

/**
 * Every function the parser actually offers, in reading order, with anything ungrouped collected
 * into `other`.
 *
 * Derived rather than listed: `builtinNames()` reads the live parser (minus `random`, which is
 * banned for determinism, and the collection-only names the disabled array grammar makes
 * unusable), so this dialog cannot drift from what a formula will accept.
 */
export function groupedFunctions(): { key: string; fns: string[] }[] {
  const available = new Set(builtinNames().functions)
  const grouped = new Set<string>()

  const groups = FUNCTION_GROUPS.map((group) => {
    const fns = group.fns.filter((fn) => {
      if (!available.has(fn)) return false
      grouped.add(fn)
      return true
    })
    return { key: group.key, fns }
  }).filter((group) => group.fns.length > 0)

  const rest = [...available].filter((fn) => !grouped.has(fn)).sort()
  return rest.length > 0 ? [...groups, { key: 'other', fns: rest }] : groups
}

const CONSTANTS = [
  { name: 'pi', alias: '\u03C0', value: '3.14159\u2026' },
  { name: 'e', alias: null, value: '2.71828\u2026' },
  { name: '\u03C6', alias: 'phi', value: '1.61803\u2026' },
] as const

const EXAMPLE_KEYS = [
  'simple',
  'power',
  'pythagorean',
  'circleArea',
  'compoundInterest',
  'conditional',
] as const

// `ternary` is GONE from this list: `a > b ? a : b` parses AND evaluates. The grammar keeps
// comparison and conditional operators precisely so they can be used inside `?:` — what it refuses
// is a comparison as the whole result, because a calc must yield a number and `a < b` yields a
// boolean. Assignment, arrays and `;` are the operators actually disabled.
const UNSUPPORTED_KEYS = [
  'comparison',
  'logical',
  'bitwise',
  'assignment',
  'arrays',
  'sequence',
  'implicitMul',
] as const

export function FormulaReferenceDialog({
  open,
  onOpenChange,
}: FormulaReferenceDialogProps) {
  const t = useTranslations('formulas.reference')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FunctionSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('description')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-6 px-6 pb-6">
            {/* Operators */}
            <section>
              <SectionHeading>{t('operatorsTitle')}</SectionHeading>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {OPERATORS.map((op) => (
                  <div
                    key={op.key}
                    className="flex items-center gap-2 rounded-md border
                      bg-muted/30 px-2.5 py-1.5"
                  >
                    <code className="font-mono text-sm font-bold text-primary min-w-[2ch] text-center">
                      {op.symbol}
                    </code>
                    <span className="text-xs text-muted-foreground truncate">
                      {t(`operators.${op.key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Functions */}
            <section>
              <SectionHeading>{t('functionsTitle')}</SectionHeading>
              <div className="space-y-3 mt-2">
                {groupedFunctions().map((group) => (
                  <div key={group.key}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                      {t(`functionGroups.${group.key}`)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.fns.map((fn) => (
                        <Badge
                          key={fn}
                          variant="secondary"
                          className="font-mono text-xs px-2 py-0.5"
                        >
                          {fn}()
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2.5 italic">
                {t('logNote')}
              </p>
            </section>

            <Separator />

            {/* Constants */}
            <section>
              <SectionHeading>{t('constantsTitle')}</SectionHeading>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {CONSTANTS.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-md
                      border bg-muted/30 px-3 py-2"
                  >
                    <code className="font-mono text-sm font-bold text-primary">
                      {c.name}
                      {c.alias && (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          / {c.alias}
                        </span>
                      )}
                    </code>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Examples */}
            <section>
              <SectionHeading>{t('examplesTitle')}</SectionHeading>
              <div className="space-y-1.5 mt-2">
                {EXAMPLE_KEYS.map((key) => (
                  <div
                    key={key}
                    className="flex items-baseline justify-between gap-4
                      rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <code className="font-mono text-sm text-foreground">
                      {t(`examples.${key}.formula`)}
                    </code>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {t(`examples.${key}.label`)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Not Supported */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                <SectionHeading>{t('unsupportedTitle')}</SectionHeading>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {UNSUPPORTED_KEYS.map((key) => (
                  <p key={key}>{t(`unsupported.${key}`)}</p>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-tight">{children}</h3>
}
