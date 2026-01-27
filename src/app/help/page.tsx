'use client'

import Link from 'next/link'
import { Download, HelpCircle, ArrowLeft } from 'lucide-react'

import { APP_ACRONYM } from '@/constants'
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
  const config = useAppConfig()
  const supportEmail = config.supportEmail

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/">
            <Button variant="ghost" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Help Center</h1>
        </div>

        <Tabs defaultValue="installation" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="installation">Installation</TabsTrigger>
            <TabsTrigger value="usage">Usage Guide</TabsTrigger>
            <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
          </TabsList>

          <TabsContent value="installation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Certificate Installation</CardTitle>
                <CardDescription>
                  Follow these steps to install your certificate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Windows</h3>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Double-click the certificate file (.p12 or .pfx)</li>
                    <li>Select "Current User" for store location</li>
                    <li>Enter your certificate password when prompted</li>
                    <li>Complete the Certificate Import Wizard</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">macOS</h3>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Double-click the certificate file</li>
                    <li>Allow Keychain Access to install</li>
                    <li>Enter your system password</li>
                    <li>Enter the certificate password</li>
                  </ol>
                </div>

                <Button variant="outline" className="mt-4">
                  <Download className="mr-2 h-4 w-4" />
                  Download Full Guide
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Using Your Certificate</CardTitle>
                <CardDescription>
                  Learn how to use your certificate with {APP_ACRONYM}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">First-Time Login</h3>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Open {APP_ACRONYM} application</li>
                    <li>Click "Authorize"</li>
                    <li>Select your certificate when prompted</li>
                    <li>Click OK/Allow</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Daily Usage</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Browser remembers your choice</li>
                    <li>May need to reselect after browser restart</li>
                    <li>Selection dialog appears if multiple certificates</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="troubleshooting" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Common Issues</CardTitle>
                <CardDescription>
                  Solutions for common certificate problems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Certificate Not Showing</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Check if certificate is installed correctly</li>
                      <li>Verify certificate hasn't expired</li>
                      <li>Ensure using supported browser</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Access Denied</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Verify correct certificate selected</li>
                      <li>Check certificate expiration</li>
                      <li>Contact administrator if issues persist</li>
                    </ul>
                  </div>
                </div>

                <Button variant="outline" className="mt-4">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Contact Support: {supportEmail}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
