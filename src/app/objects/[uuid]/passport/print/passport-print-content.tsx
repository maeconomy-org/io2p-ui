'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useObjectData } from '@/components/object-sheets/hooks'
import { PassportView } from '@/components/object-sheets/passport'

/**
 * The interactive half of the print route: it fetches, then triggers the browser print dialog.
 *
 * Split out so the route itself can stay a Server Component — the page only needs to await `params`,
 * which is not a reason to ship the whole route to the client.
 */
export function PassportPrintContent({ uuid }: { uuid: string }) {
  const t = useTranslations()
  const { object, properties, files, addressInfo, isLoading } = useObjectData({
    uuid,
    isOpen: true,
  })

  useEffect(() => {
    if (isLoading || !object) return
    // Defer until layout/paint settles so the QR canvas + fonts are present
    // in the print output.
    const id = window.setTimeout(() => window.print(), 350)
    return () => window.clearTimeout(id)
  }, [isLoading, object])

  if (isLoading || !object) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-2 py-2 print:px-0 print:py-0">
      <PassportView
        object={object}
        properties={properties}
        files={files}
        addressInfo={addressInfo}
      />
    </div>
  )
}
