'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib/observability/logger'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Textarea,
  Label,
} from '@/components/ui'

// io2p has no `abbreviation` — it was a legacy object field and is an ordinary property now.
interface TemplateData {
  name: string
  version: string
  description: string
}

interface TemplateCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: TemplateData
  onConfirm: (templateData: TemplateData) => Promise<void>
  isCreating?: boolean
}

export function TemplateCreationDialog({
  open,
  onOpenChange,
  initialData,
  onConfirm,
  isCreating = false,
}: TemplateCreationDialogProps) {
  const t = useTranslations()
  // Seeded once, not reset by an effect on `open`: every caller renders this dialog conditionally,
  // so it MOUNTS with its initial data already. The effect was re-doing what mounting had just done.
  const [templateData, setTemplateData] = useState<TemplateData>(initialData)

  const handleInputChange = (field: keyof TemplateData, value: string) => {
    setTemplateData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleConfirm = async () => {
    try {
      await onConfirm(templateData)
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the parent component
      logger.error('Error creating template:', { err: error })
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    // Reset to initial data
    setTemplateData(initialData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('objects.templateDialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('objects.templateDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="template-name">
              {t('objects.templateNameLabel')}
            </Label>
            <Input
              id="template-name"
              value={templateData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder={t('objects.templateNamePlaceholder')}
              disabled={isCreating}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-version">
              {t('objects.templateVersionLabel')}
            </Label>
            <Input
              id="template-version"
              value={templateData.version}
              onChange={(e) => handleInputChange('version', e.target.value)}
              placeholder={t('objects.templateVersionPlaceholder')}
              disabled={isCreating}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-description">
              {t('objects.templateDescriptionLabel')}
            </Label>
            <Textarea
              id="template-description"
              value={templateData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder={t('objects.templateDescriptionPlaceholder')}
              className="min-h-[80px]"
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isCreating}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isCreating || !templateData.name.trim()}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('objects.creating')}
              </>
            ) : (
              <>{t('objects.createTemplate')}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
