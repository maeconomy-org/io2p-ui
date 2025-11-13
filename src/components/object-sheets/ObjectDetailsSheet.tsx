'use client'

import { useState, useEffect } from 'react'
import { Trash2, Loader2 } from 'lucide-react'

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import { Attachment } from '@/types'
import { useUnifiedDelete } from '@/hooks'

import { DeleteConfirmationDialog } from '@/components/modals'

// Import our extracted hooks and utilities
import {
  useObjectData,
  useAddressManagement,
  usePropertyEditor,
  useObjectOperations,
  useParentManagement,
} from './hooks'
import { getObjectDisplayName, isExternalFileReference } from './utils'

// Import tab components
import { FilesTab } from './tabs/FilesTab'
import { MetadataTab } from './tabs/MetadataTab'
import { PropertiesTab } from './tabs/PropertiesTab'
import { RelationshipsTab } from './tabs/RelationshipsTab'
import { AttachmentModal } from './components/AttachmentModal'

interface ObjectSheetProps {
  isOpen: boolean
  onClose: () => void
  object?: any // Optional fallback object data
  uuid?: string // Object UUID to fetch from API
  isDeleted?: boolean
}

export function ObjectDetailsSheet({
  isOpen,
  onClose,
  object: initialObject,
  uuid,
  isDeleted,
}: ObjectSheetProps) {
  // State for UI interactions
  const [activeEditingSection, setActiveEditingSection] = useState<
    string | null
  >(null)
  const [activeTab, setActiveTab] = useState('properties')

  // File management state
  const [isObjectFilesModalOpen, setIsObjectFilesModalOpen] = useState(false)
  const [objectFiles, setObjectFiles] = useState<Attachment[]>([])

  // Property and value attachment modal states
  const [attachmentModal, setAttachmentModal] = useState<{
    isOpen: boolean
    type: 'property' | 'value' | null
    propertyUuid?: string
    valueUuid?: string
    propertyIndex?: number
    valueIndex?: number
    attachments?: Attachment[]
  }>({
    isOpen: false,
    type: null,
    attachments: [],
  })

  // Tab change handler to reset editing state when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setActiveEditingSection(null)
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset to metadata tab and clear editing state when modal opens
      setActiveTab('properties')
      setActiveEditingSection(null)
    }
  }, [isOpen])

  // Use our extracted hooks
  const {
    object,
    properties,
    addressInfo,
    files,
    isLoading,
    refetchAggregate,
  } = useObjectData({
    uuid,
    initialObject,
    isOpen,
  })

  // Initialize object files from the fetched data
  useEffect(() => {
    if (files && files.length > 0) {
      const attachments: Attachment[] = files.map((file: any) => ({
        mode: isExternalFileReference(file.fileReference)
          ? 'reference'
          : 'upload',
        fileName: file.fileName,
        fileReference: file.fileReference,
        label: file.label,
        uuid: file.uuid,
        mimeType: file.contentType,
        size: file.size,
        softDeleted: file.softDeleted,
        softDeletedAt: file.softDeletedAt,
      }))
      setObjectFiles(attachments)
    } else {
      setObjectFiles([])
    }
  }, [files])

  const { addressData, editedAddressData, setEditedAddressData, saveAddress } =
    useAddressManagement({
      initialAddressInfo: addressInfo,
      objectUuid: object?.uuid,
    })

  const { parents, setParents, saveParents } = useParentManagement({
    initialParents: object?.parents || [],
    objectUuid: object?.uuid,
    onRefetch: refetchAggregate,
  })

  const { editedProperties, setEditedProperties, saveProperties } =
    usePropertyEditor({
      initialProperties: properties,
      objectUuid: object?.uuid,
      isEditing: activeEditingSection === 'properties',
    })

  const { editedObject, setEditedObject, saveMetadata } = useObjectOperations({
    initialObject: object,
    isEditing: activeEditingSection === 'metadata',
    onRefetch: refetchAggregate,
  })

  // Unified delete hook
  const {
    isDeleteModalOpen,
    objectToDelete,
    isDeleting,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useUnifiedDelete()

  // File management handlers - now simplified since AttachmentModal handles uploads
  const handleObjectFilesChange = (newAttachments: Attachment[]) => {
    setObjectFiles(newAttachments)
  }

  const handleUploadComplete = () => {
    // Refresh the object data to show updated files
    refetchAggregate?.()
  }

  const handleCloseAttachmentModal = () => {
    setAttachmentModal({
      isOpen: false,
      type: null,
      attachments: [],
    })
  }

  // Exit early if no object and still loading
  if (!object && isOpen && !isLoading) {
    return null
  }

  // Handle saving operations
  const handleSaveMetadata = async (): Promise<void> => {
    try {
      await saveMetadata()
      setActiveEditingSection(null)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleSaveProperties = async (): Promise<void> => {
    try {
      await saveProperties()
      // Manually trigger a refetch to ensure UI updates immediately
      if (uuid && refetchAggregate) {
        refetchAggregate()
      }
      setActiveEditingSection(null)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleSaveAddress = async (): Promise<void> => {
    try {
      await saveAddress()
      setActiveEditingSection(null)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleSaveParents = async (): Promise<void> => {
    try {
      await saveParents()
      setActiveEditingSection(null)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  // Handle object deletion with unified modal
  const handleDeleteObject = (objectId: string, objectName: string) => {
    handleDelete({ uuid: objectId, name: objectName })
  }

  // Close sheet after successful delete
  useEffect(() => {
    if (!isDeleteModalOpen && objectToDelete) {
      // If modal was closed and we had an object to delete, close the sheet
      onClose()
    }
  }, [isDeleteModalOpen, objectToDelete, onClose])

  // Get computed values
  const objectName = getObjectDisplayName(object)

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <span className="flex items-center gap-2">
              <SheetTitle>{objectName}</SheetTitle>
              {(object?.softDeleted || isDeleted) && (
                <Badge variant="destructive">Deleted</Badge>
              )}
            </span>
            <SheetDescription></SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="py-6">
              <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="properties">Properties</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="relationships">Relationships</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>

                <TabsContent value="properties" className="mt-0">
                  <PropertiesTab
                    object={object}
                    properties={properties}
                    editedProperties={editedProperties}
                    setEditedProperties={setEditedProperties}
                    activeEditingSection={activeEditingSection}
                    setActiveEditingSection={setActiveEditingSection}
                    onSaveProperties={handleSaveProperties}
                    attachmentModal={attachmentModal}
                    setAttachmentModal={setAttachmentModal}
                    onUploadComplete={handleUploadComplete}
                  />
                </TabsContent>
                <TabsContent value="files" className="mt-0">
                  <FilesTab
                    object={object}
                    files={files}
                    objectFiles={objectFiles}
                    setObjectFiles={setObjectFiles}
                    isObjectFilesModalOpen={isObjectFilesModalOpen}
                    setIsObjectFilesModalOpen={setIsObjectFilesModalOpen}
                    onUploadComplete={handleUploadComplete}
                    isDeleted={isDeleted}
                  />
                </TabsContent>

                <TabsContent value="relationships" className="mt-0">
                  <RelationshipsTab
                    object={object}
                    isDeleted={isDeleted}
                    parents={parents}
                    setParents={setParents}
                    activeEditingSection={activeEditingSection}
                    setActiveEditingSection={setActiveEditingSection}
                    onSaveParents={handleSaveParents}
                  />
                </TabsContent>

                <TabsContent value="metadata" className="mt-0">
                  <MetadataTab
                    object={object}
                    addressData={addressData}
                    editedAddressData={editedAddressData}
                    setEditedAddressData={setEditedAddressData}
                    editedObject={editedObject}
                    setEditedObject={setEditedObject}
                    isDeleted={isDeleted}
                    activeEditingSection={activeEditingSection}
                    setActiveEditingSection={setActiveEditingSection}
                    onSaveMetadata={handleSaveMetadata}
                    onSaveAddress={handleSaveAddress}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}

          <SheetFooter className="border-t pt-4">
            <div className="flex w-full items-center gap-2">
              <Button type="button" onClick={onClose} className="w-full">
                Close
              </Button>
              {!isDeleted && object?.uuid && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDeleteObject(object.uuid, object.name)}
                  disabled={isDeleting}
                  className="text-destructive w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Unified Delete Confirmation Dialog */}
      {isDeleteModalOpen && objectToDelete && (
        <DeleteConfirmationDialog
          open={isDeleteModalOpen}
          onOpenChange={handleDeleteCancel}
          objectName={objectToDelete.name}
          onDelete={handleDeleteConfirm}
        />
      )}

      {/* Object Files Attachment Modal */}
      <AttachmentModal
        open={isObjectFilesModalOpen}
        onOpenChange={setIsObjectFilesModalOpen}
        attachments={objectFiles}
        onChange={handleObjectFilesChange}
        title="Object Files"
        uploadContext={{
          objectUuid: object?.uuid,
        }}
        onUploadComplete={handleUploadComplete}
      />

      {/* Property/Value Attachment Modal */}
      {attachmentModal.isOpen && object?.uuid && (
        <AttachmentModal
          open={attachmentModal.isOpen}
          onOpenChange={handleCloseAttachmentModal}
          attachments={attachmentModal.attachments || []} // Track modal-specific attachments
          onChange={(newAttachments: Attachment[]) => {
            console.log('Attachments selected:', newAttachments)
            // Update the modal state to track selected attachments
            setAttachmentModal((prev) => ({
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
            console.log('Upload completed, refreshing data')
            handleUploadComplete()
            handleCloseAttachmentModal()
          }}
        />
      )}
    </>
  )
}
