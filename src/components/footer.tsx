import Link from 'next/link'
import { FOOTER_LINKS, APP_NAME } from '@/constants'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full mt-6">
      {/* Main Footer */}
      <div className="border-t py-4 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <p>
              © {currentYear} {APP_NAME}. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Import Status Link */}
            <Link
              href="/import-status"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              Import Status
            </Link>

            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className="hover:text-foreground transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
