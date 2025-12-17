'use client'

import { useState } from 'react'
import { ChevronRight, Upload } from 'lucide-react'

import { Button, EditableSection, CopyButton } from '@/components/ui'
import { PropertySectionEditor } from '@/components/properties'
import type { Attachment, FileData } from '@/types'

import { AttachmentModal, FileList } from '../components'

// Helper function to convert API files to FileData format
const convertApiFilesToFileData = (files: any[]): FileData[] => {
  if (!files) return []
  return files.map((file: any) => ({
    uuid: file.uuid,
    fileName: file.fileName,
    fileReference: file.fileReference,
    label: file.label,
    contentType: file.contentType,
    size: file.size,
    softDeleted: file.softDeleted,
    softDeletedAt: file.softDeletedAt,
  }))
}

interface PropertiesTabProps {
  object?: any
  properties: any[]
  editedProperties: any[]
  setEditedProperties: (properties: any[]) => void
  activeEditingSection: string | null
  setActiveEditingSection: (section: string | null) => void
  onSaveProperties: () => Promise<void>
  attachmentModal: {
    isOpen: boolean
    type: 'property' | 'value' | null
    propertyUuid?: string
    valueUuid?: string
    propertyIndex?: number
    valueIndex?: number
    attachments?: Attachment[]
  }
  setAttachmentModal: (modal: any) => void
  onUploadComplete: () => void
}

export function PropertiesTab({
  object,
  properties,
  editedProperties,
  setEditedProperties,
  activeEditingSection,
  setActiveEditingSection,
  onSaveProperties,
  attachmentModal,
  setAttachmentModal,
  onUploadComplete,
}: PropertiesTabProps) {
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(
    null
  )

  // Derived states for editing modes
  const isPropertiesEditing = activeEditingSection === 'properties'

  // Handle section edit toggling
  const handleEditToggle = (section: string, isEditing: boolean) => {
    if (isEditing) {
      setActiveEditingSection(section)
    } else {
      if (activeEditingSection === section) {
        setActiveEditingSection(null)
      }
    }
  }

  // Function to toggle property expansion
  const togglePropertyExpansion = (propertyId: string) => {
    setExpandedPropertyId((prevId) =>
      prevId === propertyId ? null : propertyId
    )
  }

  // Handlers for property and value attachment modals
  const handleOpenPropertyAttachmentModal = (
    propertyUuid: string,
    _propertyIndex: number
  ) => {
    setAttachmentModal({
      isOpen: true,
      type: 'property',
      propertyUuid,
      propertyIndex: _propertyIndex,
      attachments: [],
    })
  }

  const handleOpenValueAttachmentModal = (
    propertyUuid: string,
    valueUuid: string,
    _propertyIndex: number,
    _valueIndex: number
  ) => {
    setAttachmentModal({
      isOpen: true,
      type: 'value',
      propertyUuid,
      valueUuid,
      propertyIndex: _propertyIndex,
      valueIndex: _valueIndex,
      attachments: [],
    })
  }

  const handleCloseAttachmentModal = () => {
    setAttachmentModal({
      isOpen: false,
      type: null,
      attachments: [],
    })
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Properties Section - Uses PropertySectionEditor */}
      <EditableSection
        title="Properties"
        isEditing={isPropertiesEditing}
        onEditToggle={(isEditing) => handleEditToggle('properties', isEditing)}
        onSave={onSaveProperties}
        successMessage="Object properties updated successfully"
        showToast={false}
        renderDisplay={() => (
          <div>
            {properties && properties.length > 0 ? (
              <div className="space-y-2">
                {properties.map((prop: any, idx: number) => (
                  <div
                    key={prop.uuid || idx}
                    className="border rounded-md overflow-hidden"
                  >
                    {/* Property header - always visible */}
                    <div
                      className="py-2 px-3 hover:bg-muted/20 cursor-pointer"
                      onClick={() =>
                        togglePropertyExpansion(prop.uuid || `idx-${idx}`)
                      }
                    >
                      <div className="flex items-start gap-2">
                        <ChevronRight
                          className={`h-4 w-4 mt-0.5 transition-transform flex-shrink-0 ${
                            expandedPropertyId === (prop.uuid || `idx-${idx}`)
                              ? 'rotate-90'
                              : ''
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm mb-1 break-words">
                            {prop.label || prop.key}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {expandedPropertyId === (prop.uuid || `idx-${idx}`) && (
                      <div className="border-t bg-muted/10 px-4 py-3 space-y-4">
                        {/* Property Details Header */}
                        <div className="flex items-center justify-between pb-2 border-b">
                          <div>
                            <div className="font-medium text-sm">
                              {prop.label || prop.key}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {prop.uuid || 'No UUID'}
                              </span>
                              {prop.uuid && (
                                <CopyButton
                                  text={prop.uuid}
                                  label="Property UUID"
                                  size="sm"
                                />
                              )}
                            </div>
                          </div>
                          {prop.uuid && !isPropertiesEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleOpenPropertyAttachmentModal(
                                  prop.uuid,
                                  idx
                                )
                              }
                              className="h-7 px-2"
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Attach
                            </Button>
                          )}
                        </div>

                        {/* Property Files Section */}
                        {prop.files && prop.files.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-sm font-medium">
                                Files attached to property
                              </div>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                {prop.files.length}
                              </span>
                            </div>
                            <FileList
                              files={convertApiFilesToFileData(prop.files)}
                            />
                          </div>
                        )}

                        {/* Property Values Section */}
                        <div>
                          <div className="text-sm font-medium mb-2">
                            Values ({(prop.values || []).length})
                          </div>

                          <div className="space-y-3">
                            {(prop.values || []).map(
                              (value: any, index: number) => (
                                <div
                                  key={value.uuid || `value-${index}`}
                                  className="p-3 border rounded-md bg-background space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="font-medium text-sm">
                                        {value.value}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {value.files &&
                                        value.files.length > 0 && (
                                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                            {value.files.length} file
                                            {value.files.length !== 1
                                              ? 's'
                                              : ''}
                                          </span>
                                        )}
                                      {value.uuid && !isPropertiesEditing && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleOpenValueAttachmentModal(
                                              prop.uuid,
                                              value.uuid,
                                              idx,
                                              index
                                            )
                                          }
                                          className="h-6 px-2 text-xs"
                                        >
                                          <Upload className="h-3 w-3 mr-1" />
                                          Attach
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Value Files */}
                                  {value.files && value.files.length > 0 && (
                                    <div className="border-t pt-2">
                                      <FileList
                                        files={convertApiFilesToFileData(
                                          value.files
                                        )}
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            )}

                            {(!prop.values || prop.values.length === 0) && (
                              <div className="text-sm text-muted-foreground italic">
                                No values defined
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No properties defined for this object
              </p>
            )}
          </div>
        )}
        renderEdit={() => (
          <PropertySectionEditor
            properties={editedProperties}
            isEditable={true}
            onUpdate={setEditedProperties}
          />
        )}
      />

      {/* Property/Value Attachment Modal */}
      {attachmentModal.isOpen && object?.uuid && (
        <AttachmentModal
          open={attachmentModal.isOpen}
          onOpenChange={handleCloseAttachmentModal}
          attachments={attachmentModal.attachments || []} // Track modal-specific attachments
          onChange={(newAttachments) => {
            // Update the modal state to track selected attachments
            setAttachmentModal((prev: any) => ({
              ...prev,
              attachments: newAttachments,
            }))
          }}
          title={
            attachmentModal.type === 'property'
              ? 'Attach Files to Property'
              : 'Attach Files to Value'
          }
          uploadContext={{
            objectUuid: object.uuid,
            propertyUuid: attachmentModal.propertyUuid,
            valueUuid: attachmentModal.valueUuid,
          }}
          onUploadComplete={() => {
            onUploadComplete()
            handleCloseAttachmentModal()
          }}
        />
      )}
    </div>
  )
}
