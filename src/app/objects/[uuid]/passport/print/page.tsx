'use client'

import { useEffect, use } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import ProtectedRoute from '@/components/protected-route'
import { useObjectData } from '@/components/object-sheets/hooks'
import { PassportView } from '@/components/object-sheets/passport'

interface PrintPageProps {
  params: Promise<{ uuid: string }>
}

function PassportPrintContent({ uuid }: { uuid: string }) {
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
      <div className="flex justify-center items-center py-16">
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

export default function PassportPrintPage({ params }: PrintPageProps) {
  const { uuid } = use(params)

  return (
    <div data-print-page="true">
      <ProtectedRoute>
        <PassportPrintContent uuid={uuid} />
      </ProtectedRoute>
    </div>
  )
}
