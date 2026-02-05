'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  activeEditingSection,
  setActiveEditingSection,
  onSaveMetadata,
  onSaveAddress,
}: MetadataTabProps) {
  const t = useTranslations()
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
        title={t('objects.tabs.metadata')}
        isEditing={isMetadataEditing}
        onEditToggle={(isEditing) => handleEditToggle('metadata', isEditing)}
        onSave={onSaveMetadata}
        successMessage={t('objects.metadataUpdated')}
        showToast={false}
        renderDisplay={() => (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <div className="text-sm font-medium">
                {t('objects.fields.uuid')}
              </div>
              <div className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                <span className="truncate flex">{object?.uuid}</span>
                <CopyButton
                  text={object?.uuid || ''}
                  label={t('objects.objectUuid')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-medium">
                  {t('objects.fields.name')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {object?.name}
                </div>
              </div>
              {object?.version && (
                <div>
                  <div className="text-sm font-medium">
                    {t('objects.fields.version')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {object?.version}
                  </div>
                </div>
              )}
              {object?.abbreviation && (
                <div>
                  <div className="text-sm font-medium">
                    {t('objects.fields.abbreviation')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {object?.abbreviation}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium">
                  {t('objects.fields.created')}
                </div>
                <div className="text-sm text-muted-foreground">{created}</div>
              </div>
              {updated && (
                <div>
                  <div className="text-sm font-medium">
                    {t('objects.fields.updated')}
                  </div>
                  <div className="text-sm text-muted-foreground">{updated}</div>
                </div>
              )}
            </div>
            {object?.description && (
              <div>
                <div className="text-sm font-medium">
                  {t('objects.fields.description')}
                </div>
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
                        {isDescriptionExpanded
                          ? t('objects.showLess')
                          : t('objects.showMore')}
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
                      {t('objects.deletedAt')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {softDeleteInfo.deletedAt}
                    </div>
                  </div>
                )}
                {softDeleteInfo.deletedBy && (
                  <div>
                    <div className="text-sm font-medium text-destructive">
                      {t('objects.deletedBy')}
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
              <Label htmlFor="object-name">{t('objects.fields.name')}</Label>
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
              <Label htmlFor="object-abbreviation">
                {t('objects.fields.abbreviation')}
              </Label>
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
              <Label htmlFor="object-version">
                {t('objects.fields.version')}
              </Label>
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
              <Label htmlFor="object-description">
                {t('objects.fields.description')}
              </Label>
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
        title={t('objects.fields.address')}
        isEditing={isAddressEditing}
        onEditToggle={(isEditing) => handleEditToggle('address', isEditing)}
        onSave={onSaveAddress}
        successMessage={t('objects.addressUpdated')}
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
                      <div>
                        {t('objects.address.street')}: {addressData.street}
                      </div>
                    )}
                    {addressData.houseNumber && (
                      <div>
                        {t('objects.address.number')}: {addressData.houseNumber}
                      </div>
                    )}
                    {addressData.city && (
                      <div>
                        {t('objects.address.city')}: {addressData.city}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {addressData.postalCode && (
                      <div>
                        {t('objects.address.postalCode')}:{' '}
                        {addressData.postalCode}
                      </div>
                    )}
                    {addressData.country && (
                      <div>
                        {t('objects.address.country')}: {addressData.country}
                      </div>
                    )}
                    {addressData.state && (
                      <div>
                        {t('objects.address.state')}: {addressData.state}
                      </div>
                    )}
                    {addressData.district && (
                      <div>
                        {t('objects.address.district')}: {addressData.district}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('objects.noAddress')}
              </p>
            )}
          </div>
        )}
        renderEdit={() => (
          <div className="space-y-4">
            <div>
              <Label htmlFor="address-search">
                {t('objects.buildingAddress')}
              </Label>
              <HereAddressAutocomplete
                value={editedAddressData.fullAddress}
                placeholder={t('objects.placeholders.address')}
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
                  {t('objects.addressComponents')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {editedAddressData.street && (
                    <div>
                      <strong>{t('objects.address.street')}:</strong>{' '}
                      {editedAddressData.street}
                    </div>
                  )}
                  {editedAddressData.houseNumber && (
                    <div>
                      <strong>{t('objects.address.number')}:</strong>{' '}
                      {editedAddressData.houseNumber}
                    </div>
                  )}
                  {editedAddressData.city && (
                    <div>
                      <strong>{t('objects.address.city')}:</strong>{' '}
                      {editedAddressData.city}
                    </div>
                  )}
                  {editedAddressData.postalCode && (
                    <div>
                      <strong>{t('objects.address.postalCode')}:</strong>{' '}
                      {editedAddressData.postalCode}
                    </div>
                  )}
                  {editedAddressData.country && (
                    <div>
                      <strong>{t('objects.address.country')}:</strong>{' '}
                      {editedAddressData.country}
                    </div>
                  )}
                  {editedAddressData.state && (
                    <div>
                      <strong>{t('objects.address.state')}:</strong>{' '}
                      {editedAddressData.state}
                    </div>
                  )}
                  {editedAddressData.district && (
                    <div>
                      <strong>{t('objects.address.district')}:</strong>{' '}
                      {editedAddressData.district}
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
