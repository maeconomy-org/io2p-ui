import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { SECURITY_CONTACT_EMAIL } from '@/constants/site'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

function PolicySection({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="ml-4 list-inside list-disc space-y-1 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default async function SecurityPage() {
  const t = await getTranslations('security')
  const email = SECURITY_CONTACT_EMAIL

  return (
    <div className="container mx-auto px-4 py-8" data-testid="security-page">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center">
          <Link href="/">
            <Button variant="ghost" className="mr-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>

        <p className="mb-6 text-muted-foreground">{t('intro')}</p>

        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t('noPublicIssue.title')}</AlertTitle>
          <AlertDescription>{t('noPublicIssue.description')}</AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('status.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('status.description')}
              </p>
            </CardContent>
          </Card>

          <PolicySection
            title={t('report.title')}
            description={t('report.description', { email })}
            items={t.raw('report.items') as string[]}
          />
          <PolicySection
            title={t('include.title')}
            description={t('include.description')}
            items={t.raw('include.items') as string[]}
          />
          <PolicySection
            title={t('expect.title')}
            description={t('expect.description')}
            items={t.raw('expect.items') as string[]}
          />
          <PolicySection
            title={t('scope.title')}
            description={t('scope.description')}
            items={t.raw('scope.items') as string[]}
          />
          <PolicySection
            title={t('harbour.title')}
            description={t('harbour.description', { email })}
            items={t.raw('harbour.items') as string[]}
          />
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {t('canonical')}{' '}
          <a
            href="https://io2p.org/security"
            className="underline hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            io2p.org/security
          </a>
        </p>
      </div>
    </div>
  )
}
