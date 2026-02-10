'use client'

import Link from 'next/link'
import { Download, HelpCircle, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useAppConfig } from '@/contexts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
} from '@/components/ui'

export default function HelpPage() {
  const t = useTranslations()
  const config = useAppConfig()
  const supportEmail = config.supportEmail

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/">
            <Button variant="ghost" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('help.back')}
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{t('help.title')}</h1>
        </div>

        <Tabs defaultValue="installation" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="installation">
              {t('help.installation')}
            </TabsTrigger>
            <TabsTrigger value="usage">{t('help.usageGuide')}</TabsTrigger>
            <TabsTrigger value="troubleshooting">
              {t('help.troubleshooting')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="installation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('help.certificateInstallation')}</CardTitle>
                <CardDescription>
                  {t('help.certificateInstallationDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">{t('help.windows')}</h3>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    {(t.raw('help.windowsSteps') as string[]).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">{t('help.macos')}</h3>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    {(t.raw('help.macosSteps') as string[]).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <Button variant="outline" className="mt-4">
                  <Download className="mr-2 h-4 w-4" />
                  {t('help.downloadGuide')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('help.usingCertificate')}</CardTitle>
                <CardDescription>
                  {t('help.usingCertificateDesc', {
                    acronym: config.appAcronym,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">{t('help.firstTimeLogin')}</h3>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    {(t.raw('help.firstTimeLoginSteps') as string[]).map(
                      (step, i) => (
                        <li key={i}>{step}</li>
                      )
                    )}
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">{t('help.dailyUsage')}</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    {(t.raw('help.dailyUsageItems') as string[]).map(
                      (item, i) => (
                        <li key={i}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="troubleshooting" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('help.commonIssues')}</CardTitle>
                <CardDescription>{t('help.commonIssuesDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">
                      {t('help.certificateNotShowing')}
                    </h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      {(
                        t.raw('help.certificateNotShowingItems') as string[]
                      ).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">{t('help.accessDenied')}</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      {(t.raw('help.accessDeniedItems') as string[]).map(
                        (item, i) => (
                          <li key={i}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>

                <Button variant="outline" className="mt-4">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  {t('help.contactSupport', { email: supportEmail })}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
