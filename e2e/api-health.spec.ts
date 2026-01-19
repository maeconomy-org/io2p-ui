import { test, expect } from '@playwright/test'

test.describe('API Health Checks', () => {
  test('should respond to /api/config endpoint', async ({ request }) => {
    const response = await request.get('/api/config')

    // Should return 200 OK
    expect(response.status()).toBe(200)

    // Should return JSON
    const data = await response.json()
    expect(data).toBeDefined()
  })

  test('should respond to health check endpoint', async ({ request }) => {
    // Try the health endpoint
    const response = await request.get('/health')

    // Should return some response (200 or redirect)
    expect([200, 301, 302, 307, 308]).toContain(response.status())
  })

  test('should handle import status API', async ({ request }) => {
    // Test with invalid job ID - should return error gracefully
    const response = await request.get(
      '/api/import/status?jobId=invalid-job-id'
    )

    // Should return 404 or error response, not crash
    expect([200, 400, 404]).toContain(response.status())
  })

  test('should handle system health API', async ({ request }) => {
    const response = await request.get('/api/system/health')

    // May return 401/403 if not authorized, or 200 if authorized
    expect([200, 401, 403]).toContain(response.status())
  })
})
