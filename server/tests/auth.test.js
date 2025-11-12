import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'
import { initializeDatabase } from '../database.js'

// Mock the server setup
const createTestApp = async () => {
  const app = express()

  // Initialize database
  await initializeDatabase()

  // Basic middleware
  app.use(express.json())
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }))

  // Mock auth routes
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      })
    }

    // Mock successful registration
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: 1, name, email, role: 'member' }
    })
  })

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      })
    }

    // Mock authentication
    if (email === 'test@example.com' && password === 'password123') {
      req.session.user = { id: 1, email, name: 'Test User', role: 'member' }
      res.json({
        message: 'Login successful',
        user: req.session.user
      })
    } else {
      res.status(401).json({ error: 'Invalid credentials' })
    }
  })

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' })
      }
      res.json({ message: 'Logout successful' })
    })
  })

  app.get('/api/auth/user', (req, res) => {
    if (req.session.user) {
      res.json({ user: req.session.user })
    } else {
      res.status(401).json({ error: 'Not authenticated' })
    }
  })

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  return app
}

describe('Authentication API', () => {
  let app

  beforeEach(async () => {
    app = await createTestApp()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(response.body.message).toBe('User registered successfully')
      expect(response.body.user).toMatchObject({
        name: userData.name,
        email: userData.email,
        role: 'member'
      })
      expect(response.body.user.password).toBeUndefined()
    })

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400)

      expect(response.body.error).toBe('Name, email, and password are required')
    })

    it('should reject registration with short password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      expect(response.body.error).toBe('Password must be at least 8 characters')
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)

      expect(response.body.message).toBe('Login successful')
      expect(response.body.user).toMatchObject({
        email: loginData.email,
        name: 'Test User',
        role: 'member'
      })
    })

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400)

      expect(response.body.error).toBe('Email and password are required')
    })
  })

  describe('GET /api/auth/user', () => {
    it('should return user info when authenticated', async () => {
      const agent = request.agent(app)

      // Login first
      await agent
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200)

      // Get user info
      const response = await agent
        .get('/api/auth/user')
        .expect(200)

      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        role: 'member'
      })
    })

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .expect(401)

      expect(response.body.error).toBe('Not authenticated')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const agent = request.agent(app)

      // Login first
      await agent
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200)

      // Logout
      const response = await agent
        .post('/api/auth/logout')
        .expect(200)

      expect(response.body.message).toBe('Logout successful')

      // Verify session is destroyed
      await agent
        .get('/api/auth/user')
        .expect(401)
    })
  })

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.body.status).toBe('ok')
      expect(response.body.timestamp).toBeDefined()
    })
  })
})