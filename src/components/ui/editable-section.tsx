import { ReactNode, useState } from 'react'
import { Edit, Save, X } from 'lucide-react'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { Button } from '@/components/ui'

interface EditableSectionProps {
  title: string
  isEditing: boolean
  onEditToggle: (isEditing: boolean) => void
  renderDisplay: () => ReactNode
  renderEdit: () => ReactNode
  onSave?: () => Promise<void> | void
  successMessage?: string
  showToast?: boolean
}

export function EditableSection({
  title,
  isEditing,
  onEditToggle,
  renderDisplay,
  renderEdit,
  onSave,
  successMessage = 'Changes saved successfully',
  showToast = true,
}: EditableSectionProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) {
      onEditToggle(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave()
      onEditToggle(false)

      // Show a success toast with Sonner only if showToast is true
      if (showToast) {
        toast.success(successMessage)
      }
    } catch (error) {
      logger.error('Error saving section:', error)

      // Always show error toasts
      toast.error('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>

        {isEditing ? (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditToggle(false)}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditToggle(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      <div>{isEditing ? renderEdit() : renderDisplay()}</div>
    </div>
  )
}
