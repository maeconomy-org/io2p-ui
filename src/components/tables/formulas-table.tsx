import { PencilIcon, TrashIcon, FunctionSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UUMathFormula, UUMathFormulaDTO } from 'iom-sdk'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from '@/components/ui'

interface FormulasTableProps {
  formulas: UUMathFormula[]
  onEdit: (formula: UUMathFormulaDTO) => void
  onDelete: (formula: { uuid: string; name: string }) => void
  loading?: boolean
  fetching?: boolean
}

export function FormulasTable({
  formulas,
  onEdit,
  onDelete,
  loading = false,
  fetching = false,
}: FormulasTableProps) {
  const t = useTranslations()

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('formulas.name')}</TableHead>
                <TableHead>{t('formulas.expression')}</TableHead>
                <TableHead>{t('formulas.description')}</TableHead>
                <TableHead>{t('formulas.version')}</TableHead>
                <TableHead className="text-right">
                  {t('common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-center py-8" {...{ colSpan: 5 }}>
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                    {t('common.loading')}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('formulas.name')}</TableHead>
              <TableHead>{t('formulas.expression')}</TableHead>
              <TableHead>{t('formulas.description')}</TableHead>
              <TableHead>{t('formulas.version')}</TableHead>
              <TableHead className="text-right">
                {t('common.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || fetching ? (
              <TableRow>
                <TableCell className="text-center py-4" {...{ colSpan: 5 }}>
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                    {loading ? t('common.loading') : t('common.updating')}
                  </div>
                </TableCell>
              </TableRow>
            ) : formulas.length === 0 ? (
              <TableRow>
                <TableCell className="text-center py-8" {...{ colSpan: 5 }}>
                  <div className="flex flex-col items-center">
                    <FunctionSquare className="h-10 w-10 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      {t('formulas.noFormulasTitle')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('formulas.noFormulasDescription')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              formulas.map((formula) => (
                <TableRow key={formula.uuid}>
                  <TableCell className="font-medium">{formula.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formula.expression}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {formula.description || '-'}
                  </TableCell>
                  <TableCell>{formula.version || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(formula as UUMathFormulaDTO)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          onDelete({
                            uuid: formula.uuid,
                            name: formula.name ?? '',
                          })
                        }
                      >
                        <TrashIcon className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
