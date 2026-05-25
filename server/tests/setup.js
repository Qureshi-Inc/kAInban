import fs from 'fs/promises'
import path from 'path'
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

// Test database path
const TEST_DB_PATH = path.join(process.cwd(), 'storage', 'test.db')

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: () => {},
  info: () => {},
  warn: () => {},
  error: console.error // Keep errors visible
}

// Setup test environment
beforeAll(async() => {
  // Ensure storage directory exists
  await fs.mkdir(path.dirname(TEST_DB_PATH), { recursive: true })

  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = TEST_DB_PATH
  process.env.SESSION_SECRET = 'test-session-secret'
  process.env.ALLOW_REGISTRATION = 'true'
  // OIDC env intentionally unset; isOIDCEnabled() will return false
})

// Clean up after all tests
afterAll(async() => {
  try {
    await fs.unlink(TEST_DB_PATH)
  } catch (error) {
    // Ignore if file doesn't exist
  }
})

// Clean up before each test
beforeEach(async() => {
  try {
    await fs.unlink(TEST_DB_PATH)
  } catch (error) {
    // Ignore if file doesn't exist
  }
})

// Clean up after each test
afterEach(async() => {
  // Close any open database connections
  if (global.testDb) {
    global.testDb.close()
    global.testDb = null
  }
})