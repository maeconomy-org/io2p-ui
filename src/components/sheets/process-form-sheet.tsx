'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui'
import ProcessForm from '@/components/forms/process-form'

interface ProcessFormSheetProps {
  isOpen: boolean
  onClose: () => void
  process?: any
  onSave: (process: any) => void
}

export function ProcessFormSheet({
  isOpen,
  onClose,
  process,
  onSave,
}: ProcessFormSheetProps) {
  const handleSave = (updatedProcess: any) => {
    onSave(updatedProcess)
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="mb-5">
          <SheetTitle>
            {process ? 'Edit Process Flow' : 'Create Process Flow'}
          </SheetTitle>
        </SheetHeader>

        <div className="py-4">
          <ProcessForm
            process={process}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
