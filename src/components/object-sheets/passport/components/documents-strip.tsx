import { useTranslations } from 'next-intl'
import { FileText, Image as ImageIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

import { isImageFile } from '../utils/passport-utils'

export interface PassportFile {
  uuid?: string
  fileName?: string
  contentType?: string
  softDeleted?: boolean
}

interface DocumentsStripProps {
  files: PassportFile[]
}

export function DocumentsStrip({ files }: DocumentsStripProps) {
  const t = useTranslations()
  const live = (files ?? []).filter((f) => !f.softDeleted)
  if (live.length === 0) return null

  const images = live.filter(isImageFile)
  const docs = live.filter((f) => !isImageFile(f))

  return (
    <Card data-testid="passport-card-documents">
      <CardHeader className="pt-2.5 pb-2.5 px-3">
        <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <FileText className="h-3.5 w-3.5 text-primary" />
          {t('objects.passport.documents', { count: live.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-2.5">
        {images.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {images.slice(0, 6).map((file) => (
              <div
                key={file.uuid ?? file.fileName}
                className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
              >
                <ImageIcon className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[140px]">{file.fileName}</span>
              </div>
            ))}
            {images.length > 6 && (
              <span className="text-xs text-muted-foreground">
                +{images.length - 6}
              </span>
            )}
          </div>
        )}
        {docs.length > 0 && (
          <ul className="space-y-1">
            {docs.slice(0, 8).map((file) => (
              <li
                key={file.uuid ?? file.fileName}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{file.fileName}</span>
              </li>
            ))}
            {docs.length > 8 && (
              <li className="text-xs text-muted-foreground">
                +{docs.length - 8}
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
