'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown, FunctionSquare } from 'lucide-react'
import type { UUMathFormulaDTO } from 'iom-sdk'

import { cn } from '@/lib/utils'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui'
import { useMathFormulas } from '@/hooks'

interface FormulaPickerProps {
  value?: string
  onSelect: (formula: UUMathFormulaDTO) => void
  onClear?: () => void
  disabled?: boolean
}

export function FormulaPicker({
  value,
  onSelect,
  onClear,
  disabled = false,
}: FormulaPickerProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  const { useSearchFormulas } = useMathFormulas()
  const { data: formulas = [] } = useSearchFormulas(
    { softDeleted: false },
    { enabled: open || !!value }
  )

  const selectedFormula = useMemo(
    () => formulas.find((f) => f.uuid === value),
    [formulas, value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground'
          )}
          disabled={disabled}
          data-testid="formula-picker"
        >
          {selectedFormula ? (
            <span className="flex items-center gap-2 truncate">
              <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span className="truncate">{selectedFormula.name}</span>
              <span className="text-xs text-muted-foreground font-mono truncate">
                {selectedFormula.expression}
              </span>
            </span>
          ) : (
            <span>{t('formulas.selectFormula')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={t('formulas.searchPlaceholder')} />
          <CommandList onWheel={(e) => e.stopPropagation()}>
            <CommandEmpty>{t('formulas.noFormulasTitle')}</CommandEmpty>
            <CommandGroup>
              {formulas.map((formula) => (
                <CommandItem
                  key={formula.uuid}
                  value={`${formula.name} ${formula.expression}`}
                  onSelect={() => {
                    onSelect(formula)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === formula.uuid ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{formula.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formula.expression}
                    </span>
                    {formula.description && (
                      <span className="text-xs text-muted-foreground">
                        {formula.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
