import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// Template prefix for Redis keys
const TEMPLATE_PREFIX = 'mapping_template:'

// Get all templates
export async function GET() {
  try {
    const redis = getRedis()

    // Get all template keys
    const keys = await redis.keys(`${TEMPLATE_PREFIX}*`)

    if (keys.length === 0) {
      return NextResponse.json({ templates: [] })
    }

    // Get template data for each key
    const templates = await Promise.all(
      keys.map(async (key) => {
        const data = await redis.get(key)
        if (!data) return null

        try {
          return JSON.parse(data)
        } catch (e) {
          logger.error('Failed to parse template data', { key, error: e })
          return null
        }
      })
    )

    // Filter out any null values and sort by name
    const validTemplates = templates
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ templates: validTemplates })
  } catch (error) {
    logger.error('Error fetching templates', { error })
    return NextResponse.json(
      { error: 'Failed to fetch mapping templates' },
      { status: 500 }
    )
  }
}

// Create a new template
export async function POST(req: Request) {
  try {
    const redis = getRedis()
    const { name, mapping } = await req.json()

    if (!name || !mapping) {
      return NextResponse.json(
        { error: 'Template name and mapping are required' },
        { status: 400 }
      )
    }

    // Create template ID by slugifying the name
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const key = `${TEMPLATE_PREFIX}${id}`

    // Check if template already exists
    const exists = await redis.exists(key)

    if (exists) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      )
    }

    // Save template
    const template = {
      id,
      name,
      mapping,
      createdAt: Date.now(),
    }

    await redis.set(key, JSON.stringify(template))

    return NextResponse.json({
      success: true,
      template,
    })
  } catch (error) {
    logger.error('Error creating template', { error })
    return NextResponse.json(
      { error: 'Failed to create mapping template' },
      { status: 500 }
    )
  }
}

// Delete a template
export async function DELETE(req: Request) {
  try {
    const redis = getRedis()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const key = `${TEMPLATE_PREFIX}${id}`

    // Check if template exists
    const exists = await redis.exists(key)

    if (!exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Delete template
    await redis.del(key)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting template', { error })
    return NextResponse.json(
      { error: 'Failed to delete mapping template' },
      { status: 500 }
    )
  }
}
