'use client'

import { useTranslations } from 'next-intl'
import { FunctionSquare, Ban } from 'lucide-react'

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

const FUNCTION_GROUPS = [
  {
    key: 'trigonometric',
    fns: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'],
  },
  { key: 'hyperbolic', fns: ['sinh', 'cosh', 'tanh'] },
  { key: 'logarithmic', fns: ['log', 'log2', 'log10', 'exp'] },
  { key: 'rounding', fns: ['ceil', 'floor', 'round'] },
  { key: 'other', fns: ['abs', 'sqrt', 'cbrt', 'signum', 'pow', 'min', 'max'] },
] as const

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
] as const

const UNSUPPORTED_KEYS = [
  'comparison',
  'logical',
  'bitwise',
  'ternary',
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
                {FUNCTION_GROUPS.map((group) => (
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
