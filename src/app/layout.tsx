import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { cookies } from 'next/headers'
import { getMessages, getLocale } from 'next-intl/server'

import { Providers } from '@/components/shell/providers'
import ClientLayout from '@/components/shell/client-layout'
import { buildInlineConfigScript, buildRuntimeConfig } from '@/constants/client'
import {
  PREF_COOKIE_NAME,
  decodePreferenceCookie,
} from '@/constants/preference-cookie'

export const metadata: Metadata = {
  title: process.env.APP_NAME || 'Internet of Materials',
  description: process.env.APP_DESCRIPTION || 'Material Management System',
}

const geist = Geist({ subsets: ['latin'] })

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()
  // Built once per request: handed to Providers so the client tree knows its
  // config on the FIRST render, and serialized into the inline script for the
  // module-scope readers (auth-client, upload-service) that run before React.
  const config = buildRuntimeConfig()
  // The render-critical slice of the user's node-stored preferences, so the
  // server paints the view they chose instead of the default.
  //
  // This makes the root layout REQUEST-DEPENDENT. `force-static`, ISR or
  // `cacheComponents` here would bake one account's theme and view into a shell
  // served to everyone.
  const preferenceHints = decodePreferenceCookie(
    (await cookies()).get(PREF_COOKIE_NAME)?.value
  )

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geist.className} h-full`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: buildInlineConfigScript(config),
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen h-full">
        <Providers
          locale={locale}
          messages={messages as Record<string, unknown>}
          config={config}
          preferenceHints={preferenceHints}
        >
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  )
}
