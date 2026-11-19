import { NextResponse } from 'next/server'

// Liveness probe consumed by Docker HEALTHCHECK, docker-compose healthcheck,
// and deploy.sh's post-deploy verification loop. Intentionally unauthed and
// dependency-free so a broken SDK / auth chain does not also break
// the ability to detect that the container is up.
export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: process.env.APP_VERSION ?? 'unknown',
  })
}
