import { PassportPrintContent } from './passport-print-content'

interface PrintPageProps {
  params: Promise<{ uuid: string }>
}

/**
 * A Server Component: awaiting `params` is all this route does, so none of it needs to ship to the
 * client. Auth is handled by `proxy.ts` before this renders at all — see the note there on why the
 * gate lives at the request layer rather than in a wrapper component.
 */
export default async function PassportPrintPage({ params }: PrintPageProps) {
  const { uuid } = await params

  return (
    <div data-print-page="true">
      <PassportPrintContent uuid={uuid} />
    </div>
  )
}
