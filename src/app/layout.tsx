import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

import Footer from '@/components/footer'
import ClientLayout from '@/components/client-layout'
import { APP_NAME, APP_DESCRIPTION } from '@/constants'
import { UploadProgressIndicator } from '@/components/ui'
import { ZustandDevTools } from '@/components/dev/zustand-devtools'
import { PerformanceMonitor } from '@/components/dev/performance-monitor'

import { Providers } from './providers'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
}

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.className} h-full`}
    >
      <body className="flex flex-col min-h-screen h-full">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
          <Footer />
          <Toaster />
          <UploadProgressIndicator />
          <PerformanceMonitor />
          <ZustandDevTools />
        </Providers>
      </body>
    </html>
  )
}
