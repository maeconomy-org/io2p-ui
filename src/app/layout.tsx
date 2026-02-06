import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'driver.js/dist/driver.css'
import '@/styles/driver-custom.css'
import './globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'

import ConditionalFooter from '@/components/conditional-footer'
import { Toaster } from '@/components/ui/sonner'
import ClientLayout from '@/components/client-layout'
import { ThemeProvider } from '@/components/theme-provider'
import { APP_NAME, APP_DESCRIPTION } from '@/constants'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <ClientLayout>{children}</ClientLayout>
            <ConditionalFooter />
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
