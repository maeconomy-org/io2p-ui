import Link from 'next/link'

const LINKS = [
  {
    href: '/lab/objects',
    label: 'Objects',
    body: 'The real page, in the sidebar shell',
  },
  {
    href: '/lab/agent',
    label: 'Ask agent',
    body: 'Chat with history, skills and examples',
  },
  {
    href: '/lab/processes',
    label: 'Processes',
    body: 'A second real page, to test the frame',
  },
]

export default function LabHome() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Sidebar lab</h1>
      <p className="mt-1 text-muted-foreground">
        A throwaway shell. Nothing here changes the app you already have — the
        navbar layout is untouched and still live everywhere else.
      </p>
      <div className="mt-6 divide-y rounded-md border">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <p className="font-medium">{link.label}</p>
            <p className="text-sm text-muted-foreground">{link.body}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Send feedback sits at the bottom of the sidebar. Collapse it with the
        toggle in the header.
      </p>
    </div>
  )
}
