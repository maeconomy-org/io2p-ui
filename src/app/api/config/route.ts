import { NextResponse } from 'next/server'

import { buildRuntimeConfig } from '@/constants/client'

// Runtime config API - serves env vars to client at runtime
// This allows one Docker image to work on multiple VMs with different configs
export async function GET() {
  return NextResponse.json(buildRuntimeConfig())
}
