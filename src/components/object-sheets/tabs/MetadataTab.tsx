'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'

import {
  Separator,
  Input,
  Textarea,
  Label,
  EditableSection,
  CopyButton,
  HereAddressAutocomplete,
} from '@/components/ui'
import { formatFingerprint } from '@/lib/utils'
import { getObjectTimestamps, getSoftDeleteInfo } from '../utils'

interface MetadataTabProps {
  object?: any
  addressData: any
  editedAddressData: any
  setEditedAddressData: (data: any) => void
  editedObject?: any
  setEditedObject: (object: any) => void
  isDeleted?: boolean
  activeEditingSection: string | null
  setActiveEditingSection: (section: string | null) => void
  onSaveMetadata: () => Promise<void>
  onSaveAddress: () => Promise<void>
}

export function MetadataTab({
  object,
  addressData,
  editedAddressData,
  setEditedAddressData,
  editedObject,
  setEditedObject,
  isDeleted,
  activeEditingSection,
  setActiveEditingSection,
  onSaveMetadata,
  onSaveAddress,
}: MetadataTabProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  // Derived states for editing modes
  const isMetadataEditing = activeEditingSection === 'metadata'
  const isAddressEditing = activeEditingSection === 'address'

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

  // Get computed values
  const { created, updated } = getObjectTimestamps(object)
  const softDeleteInfo = getSoftDeleteInfo(object)

  return (
    <div className="space-y-2 py-4">
      {/* Metadata Section - Editable */}
      <EditableSection
        title="Metadata"
        isEditing={isMetadataEditing}
        onEditToggle={(isEditing) => handleEditToggle('metadata', isEditing)}
        onSave={onSaveMetadata}
        successMessage="Object metadata updated successfully"
        showToast={false}
        renderDisplay={() => (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <div className="text-sm font-medium">UUID</div>
              <div className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                <span className="truncate flex">{object?.uuid}</span>
                <CopyButton text={object?.uuid || ''} label="Object UUID" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-medium">Name</div>
                <div className="text-sm text-muted-foreground">
                  {object?.name}
                </div>
              </div>
              {object?.version && (
                <div>
                  <div className="text-sm font-medium">Version</div>
                  <div className="text-sm text-muted-foreground">
                    {object?.version}
                  </div>
                </div>
              )}
              {object?.abbreviation && (
                <div>
                  <div className="text-sm font-medium">Abbreviation</div>
                  <div className="text-sm text-muted-foreground">
                    {object?.abbreviation}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium">Created</div>
                <div className="text-sm text-muted-foreground">{created}</div>
              </div>
              {updated && (
                <div>
                  <div className="text-sm font-medium">Updated</div>
                  <div className="text-sm text-muted-foreground">{updated}</div>
                </div>
              )}
            </div>
            {object?.description && (
              <div>
                <div className="text-sm font-medium">Description</div>
                <div className="text-sm text-muted-foreground">
                  {object.description.length > 100 ? (
                    <>
                      {isDescriptionExpanded
                        ? object.description
                        : `${object.description.substring(0, 100)}...`}
                      <button
                        onClick={() =>
                          setIsDescriptionExpanded(!isDescriptionExpanded)
                        }
                        className="ml-2 text-primary hover:text-primary/80 underline text-xs"
                      >
                        {isDescriptionExpanded ? 'Show less' : 'Show more'}
                      </button>
                    </>
                  ) : (
                    object.description
                  )}
                </div>
              </div>
            )}

            {/* Display soft delete metadata if object is deleted */}
            {softDeleteInfo && (
              <div className="grid grid-cols-2 gap-3">
                {softDeleteInfo.deletedAt && (
                  <div>
                    <div className="text-sm font-medium text-destructive">
                      Deleted At
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {softDeleteInfo.deletedAt}
                    </div>
                  </div>
                )}
                {softDeleteInfo.deletedBy && (
                  <div>
                    <div className="text-sm font-medium text-destructive">
                      Deleted By
                    </div>
                    <div
                      className="text-sm text-muted-foreground font-mono"
                      title={softDeleteInfo.deletedBy}
                      aria-label={softDeleteInfo.deletedBy}
                    >
                      {formatFingerprint(softDeleteInfo.deletedBy)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        renderEdit={() => (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="object-name">Name</Label>
              <Input
                id="object-name"
                value={editedObject?.name || ''}
                onChange={(e) =>
                  setEditedObject({
                    ...editedObject,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="object-abbreviation">Abbreviation</Label>
              <Input
                id="object-abbreviation"
                value={editedObject?.abbreviation || ''}
                onChange={(e) =>
                  setEditedObject({
                    ...editedObject,
                    abbreviation: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="object-version">Version</Label>
              <Input
                id="object-version"
                value={editedObject?.version || ''}
                onChange={(e) =>
                  setEditedObject({
                    ...editedObject,
                    version: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="object-description">Description</Label>
              <Textarea
                id="object-description"
                value={editedObject?.description || ''}
                onChange={(e) =>
                  setEditedObject({
                    ...editedObject,
                    description: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
          </div>
        )}
      />

      {/* Address Section */}
      <Separator />
      <EditableSection
        title="Address"
        isEditing={isAddressEditing}
        onEditToggle={(isEditing) => handleEditToggle('address', isEditing)}
        onSave={onSaveAddress}
        successMessage="Address updated successfully"
        showToast={false}
        renderDisplay={() => (
          <div>
            {addressData.fullAddress ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-sm">{addressData.fullAddress}</div>
                </div>

                <div className="ml-6 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    {addressData.street && (
                      <div>Street: {addressData.street}</div>
                    )}
                    {addressData.houseNumber && (
                      <div>House Number: {addressData.houseNumber}</div>
                    )}
                    {addressData.city && <div>City: {addressData.city}</div>}
                  </div>
                  <div className="space-y-1">
                    {addressData.postalCode && (
                      <div>Postal Code: {addressData.postalCode}</div>
                    )}
                    {addressData.country && (
                      <div>Country: {addressData.country}</div>
                    )}
                    {addressData.state && <div>State: {addressData.state}</div>}
                    {addressData.district && (
                      <div>District: {addressData.district}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No address specified for this object
              </p>
            )}
          </div>
        )}
        renderEdit={() => (
          <div className="space-y-4">
            <div>
              <Label htmlFor="address-search">Building Address</Label>
              <HereAddressAutocomplete
                value={editedAddressData.fullAddress}
                placeholder="Search for building address..."
                onAddressSelect={(fullAddress, components) => {
                  setEditedAddressData({
                    fullAddress,
                    street: components?.street,
                    houseNumber: components?.houseNumber,
                    city: components?.city,
                    postalCode: components?.postalCode,
                    country: components?.country,
                    state: components?.state,
                    district: components?.district || '',
                  })
                }}
                className="mt-1"
              />
            </div>

            {(editedAddressData.street ||
              editedAddressData.city ||
              editedAddressData.country) && (
              <div className="p-3 bg-muted/20 rounded-md">
                <div className="text-sm font-medium mb-2">
                  Address Components:
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {editedAddressData.street && (
                    <div>
                      <strong>Street:</strong> {editedAddressData.street}
                    </div>
                  )}
                  {editedAddressData.houseNumber && (
                    <div>
                      <strong>Number:</strong> {editedAddressData.houseNumber}
                    </div>
                  )}
                  {editedAddressData.city && (
                    <div>
                      <strong>City:</strong> {editedAddressData.city}
                    </div>
                  )}
                  {editedAddressData.postalCode && (
                    <div>
                      <strong>Postal Code:</strong>{' '}
                      {editedAddressData.postalCode}
                    </div>
                  )}
                  {editedAddressData.country && (
                    <div>
                      <strong>Country:</strong> {editedAddressData.country}
                    </div>
                  )}
                  {editedAddressData.state && (
                    <div>
                      <strong>State:</strong> {editedAddressData.state}
                    </div>
                  )}
                  {editedAddressData.district && (
                    <div>
                      <strong>District:</strong> {editedAddressData.district}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      />
    </div>
  )
}
