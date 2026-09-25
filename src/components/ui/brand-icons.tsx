import { cn } from '@/lib/utils'

type BrandIconProps = {
  className?: string
}

// Brand marks are reproduced verbatim, with their official palettes hardcoded rather than themed:
// both Google and Microsoft require the exact mark, and a recolored one breaks their brand terms.

export function GoogleIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.395 3.622v3.01h3.878c2.269-2.089 3.579-5.165 3.579-8.819Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.956-1.075 7.941-2.908l-3.878-3.01c-1.075.72-2.45 1.145-4.063 1.145-3.125 0-5.77-2.11-6.714-4.947H1.276v3.109A11.995 11.995 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.286 14.28a7.212 7.212 0 0 1 0-4.56V6.611H1.276a11.998 11.998 0 0 0 0 10.778l4.01-3.109Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.773c1.762 0 3.344.606 4.588 1.795l3.442-3.442C17.951 1.19 15.235 0 12 0A11.995 11.995 0 0 0 1.276 6.611l4.01 3.109C6.23 6.883 8.875 4.773 12 4.773Z"
      />
    </svg>
  )
}

export function MicrosoftIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#F25022" d="M1 1h10.4v10.4H1z" />
      <path fill="#7FBA00" d="M12.6 1H23v10.4H12.6z" />
      <path fill="#00A4EF" d="M1 12.6h10.4V23H1z" />
      <path fill="#FFB900" d="M12.6 12.6H23V23H12.6z" />
    </svg>
  )
}
