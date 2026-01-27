'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useAppConfig } from '@/contexts'

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Introduction</h2>
          <p>
            {appName} ("we", "our", or "us") is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, and share
            information about you when you use our materials management system
            and related services.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <p>
            We collect information in several ways when you use our service:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Client Certificate Information:</strong> We collect
              information from your client certificates used for authentication.
            </li>
            <li>
              <strong>Usage Information:</strong> We collect information about
              how you interact with our service, including the objects and
              processes you view and modify.
            </li>
            <li>
              <strong>Log Data:</strong> Our servers automatically record
              information created when you use our services.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Authenticate your identity and provide secure access</li>
            <li>Monitor and analyze usage patterns and trends</li>
            <li>
              Protect against unauthorized access and potential security threats
            </li>
            <li>Communicate with you about the service</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Contact Us</h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or
            our data practices, please contact us at:
          </p>
          <p className="font-medium">{supportEmail}</p>
        </section>
      </div>
    </div>
  )
}
