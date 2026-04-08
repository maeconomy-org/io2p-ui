import Link from 'next/link'
import { Home, FileQuestion } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui'

export default function NotFound() {
  const t = useTranslations()

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full text-center">
        <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t('errors.notFound.title')}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t('errors.notFound.description')}
        </p>
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            {t('errors.notFound.goHome')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
