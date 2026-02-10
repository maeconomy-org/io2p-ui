import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'driver.js/dist/driver.css'
import '@/styles/driver-custom.css'
import './globals.css'
import { getMessages, getLocale } from 'next-intl/server'

import { Providers } from '@/components/providers'
import ClientLayout from '@/components/client-layout'

export const metadata: Metadata = {
  title: process.env.APP_NAME || 'Internet of Materials',
  description: process.env.APP_DESCRIPTION || 'Material Management System',
}

const inter = Inter({ subsets: ['latin'] })

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.className} h-full`}
    >
      <body className="flex flex-col min-h-screen h-full">
        <Providers
          locale={locale}
          messages={messages as Record<string, unknown>}
        >
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
