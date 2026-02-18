'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
} from '@/components/ui'

interface ImportPreviewProps {
  data: any[]
  onBack?: () => void
  onImport: () => Promise<void>
  title?: string
  description?: string
  isImporting: boolean
}

export function ImportPreview({
  data,
  onBack,
  onImport,
  title,
  description,
  isImporting,
}: ImportPreviewProps) {
  const t = useTranslations()
  // Limit preview to first 10 rows for performance
  const previewData = data.slice(0, 10)
  const totalRows = data.length
  const showingRows = previewData.length

  // Get all unique property keys from the data
  const propertyKeys = useMemo(() => {
    const keys = new Set<string>()

    // Extract all property keys from the first 10 objects
    previewData.forEach((item) => {
      // Get regular properties
      Object.keys(item).forEach((key) => {
        if (key !== 'properties') {
          keys.add(key)
        }
      })

      // Get custom properties
      if (Array.isArray(item.properties)) {
        item.properties.forEach((prop: any) => {
          if (prop.key) {
            keys.add(prop.key)
          }
        })
      } else if (item.properties && typeof item.properties === 'object') {
        Object.keys(item.properties).forEach((key) => {
          keys.add(key)
        })
      }
    })

    // Convert to array and sort alphabetically
    return Array.from(keys).sort()
  }, [previewData])

  // Function to export the complete JSON data
  const handleExportJson = () => {
    // Create a JSON blob with all data
    const jsonData = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })

    // Create a download link and trigger the download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `imported-objects-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()

    // Clean up
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle back button
  const handleBack = () => {
    if (onBack) {
      onBack()
    }
  }

  // Handle the import
  const handleImport = async () => {
    await onImport()
  }

  // Format cell value for display
  const formatCellValue = (item: any, key: string) => {
    // Check if it's a regular property
    if (key in item) {
      const value = item[key]
      if (value === null || value === undefined) {
        return '-'
      }
      return String(value)
    }

    // Check if it's in the properties array
    if (item.properties && Array.isArray(item.properties)) {
      const property = item.properties.find((p: any) => p.key === key)
      if (property && property.values && property.values.length > 0) {
        return property.values[0].value || '-'
      }
    } else if (
      item.properties &&
      typeof item.properties === 'object' &&
      key in item.properties
    ) {
      // Handle object format of properties
      return String(item.properties[key]) || '-'
    }

    return '-'
  }

  return (
    <div className="space-y-6">
      {title && description && (
        <div className="space-y-1 mb-4">
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {t('import.preview.objects', { count: totalRows })}
            </Badge>
            <Badge variant="outline">
              {t('import.preview.properties', { count: propertyKeys.length })}
            </Badge>
            <Badge variant="outline">
              {showingRows < totalRows
                ? t('import.preview.previewing', {
                    shown: showingRows,
                    total: totalRows,
                  })
                : t('import.preview.allShown')}
            </Badge>
            {showingRows < totalRows && (
              <p className="text-xs text-muted-foreground ml-2">
                {t('import.preview.note', {
                  total: totalRows,
                  shown: showingRows,
                })}
              </p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            <span>{t('import.preview.exportJson')}</span>
          </Button>
        </div>

        <div className="border rounded-md">
          <div className="p-3 border-b flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {t('import.preview.objectsToImport')}
            </h4>
          </div>
          <div className="relative h-[400px] overflow-auto">
            <div className="min-w-max">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-20 w-[60px]">
                      #
                    </TableHead>
                    {propertyKeys.map((key) => (
                      <TableHead
                        key={key}
                        className="min-w-[150px] whitespace-nowrap"
                      >
                        {key}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((item, index) => (
                    <TableRow key={JSON.stringify(item)}>
                      <TableCell className="sticky left-0 bg-background z-20">
                        {index + 1}
                      </TableCell>
                      {propertyKeys.map((key) => (
                        <TableCell
                          key={key}
                          className="min-w-[150px] max-w-[300px] whitespace-nowrap overflow-hidden text-ellipsis"
                          title={formatCellValue(item, key)}
                        >
                          {formatCellValue(item, key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleBack} disabled={isImporting}>
            {t('import.map.back')}
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || totalRows === 0}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('import.preview.importing')}
              </>
            ) : (
              t('import.preview.import', { count: totalRows })
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
