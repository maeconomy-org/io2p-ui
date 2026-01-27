'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useAppConfig } from '@/contexts'

export default function TermsPage() {
  const config = useAppConfig()
  const appName = config.appName
  const supportEmail = config.supportEmail

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the {appName} materials management system
            ("Service"), you agree to be bound by these Terms of Service
            ("Terms"). If you do not agree to these Terms, please do not use the
            Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Use of Service</h2>
          <p>
            You agree to use the Service only for its intended purpose as a
            materials management system for buildings. You must not misuse the
            Service, including but not limited to engaging in any unlawful
            activities or violating any applicable regulations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            3. Client Certificate Authentication
          </h2>
          <p>
            Access to the Service requires valid client certificates. You are
            responsible for maintaining the security of your certificates and
            for all activities that occur under your account. You must notify us
            immediately of any unauthorized use of your certificates or any
            other breach of security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, {appName} shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, including but not limited to, loss of profits,
            data, or use, arising out of or in any way connected with the use of
            or inability to use the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will
            provide notice of significant changes to these Terms by placing a
            prominent notice on our Service. Your continued use of the Service
            after such modifications will constitute your acknowledgment and
            agreement to the modified Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="font-medium">{supportEmail}</p>
        </section>
      </div>
    </div>
  )
}
