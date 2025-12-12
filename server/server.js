import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import connectSqlite3 from 'connect-sqlite3'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import morgan from 'morgan'
import * as db from './database.js'
import dbInstance from './database.js'
import * as localAuth from './localAuth.js'
import * as oidcAuth from './oidcAuth.js'
import PocketIDIntegration from './pocketIdIntegration.js'

const app = express()
const PORT = process.env.PORT || 3001
const STORAGE_DIR = process.env.STORAGE_DIR || './storage'
const MEETINGS_DIR = path.join(STORAGE_DIR, 'meetings')
const SQLiteStore = connectSqlite3(session)

// Trust proxy (nginx reverse proxy)
app.set('trust proxy', 1)

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for Vite dev
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.openai.com',
          'https://*.openai.azure.com'
        ],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false, // Disable for audio processing
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
)

// Note: CSRF protection disabled for MVP but should be implemented for production
// TODO: Implement proper CSRF protection using csrf-csrf or similar package

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
})

// Apply global rate limiting
app.use(globalLimiter)

// Dynamic CORS configuration based on environment variables
const corsOrigins = [
  'http://localhost:8064',
  'https://localhost:8064',
  /^http:\/\/192\.168\.\d+\.\d+:8064$/, // Allow local IP addresses
  /^http:\/\/10\.\d+\.\d+\.\d+:8064$/ // Allow private network IPs
]

// Add APP_URL and its variations if configured
if (process.env.APP_URL) {
  const appUrl = new URL(process.env.APP_URL)
  const baseUrl = `${appUrl.protocol}//${appUrl.hostname}`

  corsOrigins.push(process.env.APP_URL) // Full URL
  corsOrigins.push(baseUrl) // Base domain

  // Add port variations for local development
  if (
    appUrl.hostname === 'localhost' ||
    appUrl.hostname.includes('127.0.0.1')
  ) {
    corsOrigins.push(`${baseUrl}:8064`)
    corsOrigins.push(`http://${appUrl.hostname}:8064`)
    corsOrigins.push(`https://${appUrl.hostname}:8064`)
  }
}

// Add LANDING_PAGE_URL if different from APP_URL
if (
  process.env.LANDING_PAGE_URL &&
  process.env.LANDING_PAGE_URL !== process.env.APP_URL
) {
  corsOrigins.push(process.env.LANDING_PAGE_URL)
}

// Log CORS configuration for debugging
console.log('[CORS] Configured origins:', corsOrigins)
console.log('[CORS] Environment variables:')
console.log('  APP_URL:', process.env.APP_URL)
console.log('  LANDING_PAGE_URL:', process.env.LANDING_PAGE_URL)

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      console.log('[CORS] Request from origin:', origin)

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true)
      }

      // Check if origin is in allowed list
      const isAllowed = corsOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return allowedOrigin === origin
        } else if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin)
        }
        return false
      })

      if (isAllowed) {
        console.log('[CORS] Origin allowed:', origin)
        return callback(null, true)
      } else {
        console.log('[CORS] Origin blocked:', origin)
        console.log('[CORS] Allowed origins:', corsOrigins)
        return callback(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization'
    ]
  })
)
app.use(express.json({ limit: '100mb' })) // Increased from 50mb to 100mb
app.use(express.urlencoded({ limit: '100mb', extended: true })) // Added for form data
app.use(morgan('combined')) // Changed to combined for better security logging

// Session middleware
app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: STORAGE_DIR
    }),
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'notes.sid',
    cookie: {
      secure: 'auto', // Auto-detect based on X-Forwarded-Proto header
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax', // Changed back to lax for same-site
      path: '/'
    },
    rolling: true,
    proxy: true
  })
)

// Initialize PocketID integration
const pocketIdIntegration = new PocketIDIntegration({
  pocketIdUrl: process.env.POCKETID_URL || 'https://login.qureshi.io',
  clientId: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  adminToken: process.env.POCKETID_ADMIN_TOKEN // Optional admin API token
})

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
})

// Special rate limiter for signup endpoints (more lenient)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 signups per hour per IP
  message: { error: 'Too many signup attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
})

// Note: CSRF token endpoint disabled for MVP
// app.get('/api/csrf-token', (req, res) => {
//   res.json({ csrfToken: 'disabled-for-mvp' })
// })

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' })
})

// Authentication endpoints
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body

    // Check if registration is allowed
    const isFirstUser = !db.hasUsers()
    const allowRegistration =
      process.env.ALLOW_REGISTRATION === 'true' ||
      process.env.ALLOW_REGISTRATION === '1'

    // Allow registration if it's the first user (admin setup) or if registration is enabled
    if (!isFirstUser && !allowRegistration) {
      return res
        .status(403)
        .json({ error: 'Registration is currently disabled' })
    }

    // Register user
    const user = await localAuth.registerUser({ email, password, name })

    // Create session
    req.session.user = localAuth.formatUserForSession(user)

    // Explicitly save session
    req.session.save(err => {
      if (err) {
        console.error('[Auth] Session save error:', err)
        return res.status(500).json({ error: 'Failed to create session' })
      }
      console.log('[Auth] User registered and logged in:', user.email)
      console.log('[Auth] Session ID:', req.sessionID)
      res.json({
        success: true,
        user: req.session.user
      })
    })
  } catch (error) {
    console.error('[Auth] Registration error:', error.message)
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body

    // Authenticate user
    const user = await localAuth.authenticateUser(email, password)

    // Create session
    req.session.user = localAuth.formatUserForSession(user)

    // Explicitly save session
    req.session.save(err => {
      if (err) {
        console.error('[Auth] Session save error:', err)
        return res.status(500).json({ error: 'Failed to create session' })
      }
      console.log('[Auth] User logged in:', user.email)
      console.log('[Auth] Session ID:', req.sessionID)
      res.json({
        success: true,
        user: req.session.user
      })
    })
  } catch (error) {
    console.error('[Auth] Login error:', error.message)
    res.status(401).json({ error: error.message })
  }
})

app.post('/api/auth/logout', (req, res) => {
  const userEmail = req.session?.user?.email
  req.session.destroy(err => {
    if (err) {
      console.error('[Auth] Logout error:', err)
      return res.status(500).json({ error: 'Failed to logout' })
    }
    res.clearCookie('notes.sid') // Match the custom session cookie name
    console.log('[Auth] User logged out:', userEmail)
    res.json({ success: true })
  })
})

app.get('/api/auth/me', (req, res) => {
  console.log('[Auth] /me called - Session ID:', req.sessionID)
  console.log(
    '[Auth] /me called - Session user:',
    req.session?.user?.email || 'none'
  )
  console.log(
    '[Auth] /me called - Cookie header:',
    req.headers.cookie ? 'present' : 'missing'
  )

  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: req.session.user })
})

app.get('/api/auth/status', (req, res) => {
  const allowRegistration =
    process.env.ALLOW_REGISTRATION === 'true' ||
    process.env.ALLOW_REGISTRATION === '1'
  const hasUsers = db.hasUsers()

  res.json({
    authenticated: !!req.session?.user,
    hasUsers: hasUsers,
    allowRegistration: allowRegistration || !hasUsers // Always allow registration for first user
  })
})

// OIDC Authentication endpoints
app.get('/api/auth/oidc/config', localAuth.requireAuth, (req, res) => {
  // Only admins can check OIDC config
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const settings = db.getSettings(req.session.user.id)
  const enabled = oidcAuth.isOIDCEnabled(settings)

  res.json({
    enabled,
    issuer: settings?.oidc_issuer || 'https://pocketid.app'
  })
})

app.get('/api/auth/oidc/status', (req, res) => {
  // Check if OIDC is enabled (read from system-wide settings)
  const systemSettings = db.getSystemSettings()

  console.log('[OIDC Status] System settings:', {
    oidc_enabled: systemSettings?.oidc_enabled,
    has_client_id: !!systemSettings?.oidc_client_id,
    has_client_secret: !!systemSettings?.oidc_client_secret,
    has_issuer: !!systemSettings?.oidc_issuer,
    has_callback_url: !!systemSettings?.oidc_callback_url
  })

  const enabled = oidcAuth.isOIDCEnabled(systemSettings)
  console.log('[OIDC Status] isOIDCEnabled result:', enabled)

  res.json({
    enabled,
    issuer: systemSettings?.oidc_issuer || 'https://pocketid.app'
  })
})

app.get('/api/auth/oidc/login', async (req, res) => {
  try {
    // Get system settings to check if OIDC is enabled
    const settings = db.getSystemSettings()

    if (!oidcAuth.isOIDCEnabled(settings)) {
      return res.status(400).json({ error: 'OIDC is not enabled' })
    }

    // Initialize OIDC client
    await oidcAuth.initializeOIDC({
      oidcEnabled: settings.oidc_enabled,
      oidcClientId: settings.oidc_client_id,
      oidcClientSecret: settings.oidc_client_secret,
      oidcIssuer: settings.oidc_issuer,
      oidcCallbackUrl: settings.oidc_callback_url
    })

    // Generate authorization URL
    const { authUrl, codeVerifier, state } =
      oidcAuth.getAuthorizationUrl(settings)

    // Store code verifier and state in session
    req.session.oidcCodeVerifier = codeVerifier
    req.session.oidcState = state

    req.session.save(err => {
      if (err) {
        console.error('[OIDC] Session save error:', err)
        return res.status(500).json({ error: 'Failed to create OIDC session' })
      }
      res.json({ authUrl })
    })
  } catch (error) {
    console.error('[OIDC] Login error:', error)
    res.status(500).json({ error: 'Failed to initiate OIDC login' })
  }
})

app.get('/api/auth/oidc/callback', async (req, res) => {
  try {
    const codeVerifier = req.session.oidcCodeVerifier
    const state = req.session.oidcState

    if (!codeVerifier || !state) {
      return res.status(400).json({ error: 'Invalid OIDC session' })
    }

    // Get admin settings
    const allUsers = db.getAllUsers()
    const adminUser = allUsers.find(u => u.role === 'admin' && u.active === 1)

    if (!adminUser) {
      return res.status(400).json({ error: 'OIDC not configured' })
    }

    const settings = db.getSettings(adminUser.id)

    // Re-initialize OIDC client (in case it wasn't kept in memory)
    await oidcAuth.initializeOIDC({
      oidcEnabled: settings.oidc_enabled,
      oidcClientId: settings.oidc_client_id,
      oidcClientSecret: settings.oidc_client_secret,
      oidcIssuer: settings.oidc_issuer,
      oidcCallbackUrl: settings.oidc_callback_url
    })

    // Handle callback
    const callbackUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    const { userinfo } = await oidcAuth.handleCallback(
      callbackUrl,
      codeVerifier,
      state
    )

    // Find or create user
    const user = oidcAuth.findOrCreateOIDCUser(userinfo, settings.oidc_issuer)

    // Create session
    req.session.user = oidcAuth.formatUserForSession(user)
    delete req.session.oidcCodeVerifier
    delete req.session.oidcState

    req.session.save(err => {
      if (err) {
        console.error('[OIDC] Session save error:', err)
        return res.status(500).json({ error: 'Failed to create session' })
      }

      console.log('[OIDC] User logged in:', user.email)

      // Redirect to frontend with success
      const frontendUrl = process.env.APP_URL
      if (!frontendUrl) {
        console.error('[OIDC] Missing APP_URL environment variable')
        return res
          .status(500)
          .json({ error: 'Server configuration error: Missing APP_URL' })
      }
      res.redirect(`${frontendUrl}?oidc_success=true`)
    })
  } catch (error) {
    console.error('[OIDC] Callback error:', error)
    const frontendUrl = process.env.APP_URL
    if (!frontendUrl) {
      console.error('[OIDC] Missing APP_URL environment variable')
      return res
        .status(500)
        .json({ error: 'Server configuration error: Missing APP_URL' })
    }
    res.redirect(
      `${frontendUrl}?oidc_error=${encodeURIComponent(error.message)}`
    )
  }
})

// PocketID Signup endpoints (Landing Page Integration)
app.post('/api/auth/create-signup-intent', signupLimiter, async (req, res) => {
  try {
    const { email, name, source } = req.body

    // Basic validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' })
    }

    // Create signup intent
    const intent = pocketIdIntegration.createSignupIntent(email, name, source)

    console.log(`[Signup] Created intent ${intent.id} for ${email}`)

    res.json({
      success: true,
      id: intent.id,
      email: intent.email,
      expiresAt: intent.expiresAt
    })
  } catch (error) {
    console.error('[Signup] Intent creation error:', error)
    res.status(500).json({ error: 'Failed to create signup intent' })
  }
})

app.post(
  '/api/auth/send-pocketid-invitation',
  signupLimiter,
  async (req, res) => {
    try {
      const { email, name, returnUrl } = req.body

      // Basic validation
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' })
      }

      // Process the signup through PocketID integration
      const result = await pocketIdIntegration.processSignup(
        email,
        name,
        returnUrl
      )

      console.log(
        `[Signup] Processed signup for ${email} via method: ${result.method}`
      )

      res.json(result)
    } catch (error) {
      console.error('[Signup] PocketID invitation error:', error)
      res.status(500).json({
        error: 'Signup process failed',
        details: error.message
      })
    }
  }
)

app.post('/api/auth/send-magic-link', signupLimiter, async (req, res) => {
  try {
    const { email, name } = req.body

    // Basic validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' })
    }

    // Create signup intent
    const intent = pocketIdIntegration.createSignupIntent(
      email,
      name,
      'magic_link'
    )

    // Generate registration link
    const registrationLink = pocketIdIntegration.generateRegistrationLink(
      email,
      name,
      intent.id
    )

    // Send custom email (this will use your email service)
    const emailResult = await pocketIdIntegration.sendRegistrationEmail(
      email,
      name,
      intent.id
    )

    if (emailResult.success) {
      console.log(`[Signup] Magic link sent to ${email}`)
      res.json({
        success: true,
        message: 'Magic link sent! Check your email to complete setup.',
        registrationLink: emailResult.registrationLink
      })
    } else {
      // Fallback: return manual instructions
      res.json({
        success: true,
        message: 'Please complete your registration manually.',
        registrationLink,
        instructions: {
          steps: [
            `Visit ${pocketIdIntegration.pocketIdUrl}`,
            `Create account with email: ${email}`,
            'Enable passkey in Security settings',
            'Return to kAInban and sign in'
          ]
        }
      })
    }
  } catch (error) {
    console.error('[Signup] Magic link error:', error)
    res.status(500).json({
      error: 'Failed to send magic link',
      details: error.message
    })
  }
})

// Get signup intent status (for tracking)
app.get('/api/auth/signup-intent/:intentId', (req, res) => {
  try {
    const { intentId } = req.params
    const intent = pocketIdIntegration.getSignupIntent(intentId)

    if (!intent) {
      return res
        .status(404)
        .json({ error: 'Signup intent not found or expired' })
    }

    res.json({
      id: intent.id,
      email: intent.email,
      status: intent.status,
      method: intent.method,
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt
    })
  } catch (error) {
    console.error('[Signup] Intent status error:', error)
    res.status(500).json({ error: 'Failed to get signup status' })
  }
})

// Settings endpoints
app.get('/api/settings', localAuth.requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    const settings = db.getSettings(userId)

    // If no settings in database, return environment variables
    if (!settings || !settings.azure_endpoint) {
      const enableOidc =
        process.env.ENABLE_OIDC === 'true' || process.env.ENABLE_OIDC === '1'
      console.log(
        '[Settings] ENABLE_OIDC env:',
        process.env.ENABLE_OIDC,
        '-> enabled:',
        enableOidc
      )
      console.log(
        '[Settings] POCKET_ID_CLIENT_ID env:',
        process.env.POCKET_ID_CLIENT_ID
      )
      return res.json({
        azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
        whisperDeployment:
          process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper',
        gptDeployment: process.env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4',
        oidcEnabled: enableOidc,
        oidcClientId: process.env.POCKET_ID_CLIENT_ID || '',
        oidcClientSecret: process.env.POCKET_ID_CLIENT_SECRET || '',
        oidcIssuer: process.env.POCKET_ID_ISSUER || 'https://pocketid.app',
        oidcCallbackUrl: ''
      })
    }

    // Return database settings with environment variable fallbacks
    res.json({
      azureEndpoint: settings.azure_endpoint || '',
      apiKey: settings.api_key || '',
      apiVersion: settings.api_version || '2024-02-01',
      whisperDeployment: settings.whisper_deployment || 'whisper-1',
      gptDeployment: settings.gpt_deployment || 'gpt-4',
      oidcEnabled: settings.oidc_enabled === 1,
      oidcClientId:
        settings.oidc_client_id || process.env.POCKET_ID_CLIENT_ID || '',
      oidcClientSecret:
        settings.oidc_client_secret ||
        process.env.POCKET_ID_CLIENT_SECRET ||
        '',
      oidcIssuer:
        settings.oidc_issuer ||
        process.env.POCKET_ID_ISSUER ||
        'https://pocketid.app',
      oidcCallbackUrl: settings.oidc_callback_url || ''
    })
  } catch (error) {
    console.error('[Settings] Get error:', error)
    res.status(500).json({ error: 'Failed to get settings' })
  }
})

app.post('/api/settings', localAuth.requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    db.saveSettings(userId, req.body)
    console.log('[Settings] Saved successfully for user:', userId)
    res.json({ success: true })
  } catch (error) {
    console.error('[Settings] Save error:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// User management endpoints (admin only)
app.get('/api/users', localAuth.requireAuth, (req, res) => {
  try {
    // Only admins can view users
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const users = db.getAllUsers()

    // Format users for frontend (don't send password hashes or secrets)
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      auth_provider: user.auth_provider,
      email_verified: user.email_verified === 1,
      active: user.active === 1,
      last_login: user.last_login,
      created_at: user.created_at,
      oidc_issuer: user.oidc_issuer
    }))

    res.json(formattedUsers)
  } catch (error) {
    console.error('[Users] List error:', error)
    res.status(500).json({ error: 'Failed to get users' })
  }
})

app.delete('/api/users/:id', localAuth.requireAuth, (req, res) => {
  try {
    // Only admins can delete users
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const userId = parseInt(req.params.id)

    // Can't delete yourself
    if (userId === req.session.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }

    db.deleteUser(userId)
    res.json({ success: true })
  } catch (error) {
    console.error('[Users] Delete error:', error)
    res.status(400).json({ error: error.message })
  }
})

// Project endpoints
app.get('/api/projects', localAuth.requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    const projects = db.getAllProjects(userId).map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      lastModified: p.updated_at
    }))
    res.json(projects)
  } catch (error) {
    console.error('[Projects] List error:', error)
    res.status(500).json({ error: 'Failed to get projects' })
  }
})

app.get('/api/projects/:id', localAuth.requireAuth, (req, res) => {
  try {
    const project = db.getProject(req.params.id)
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Debug logging for ownership check
    console.log('[Projects] Ownership check:')
    console.log('  project.user_id:', project.user_id, typeof project.user_id)
    console.log(
      '  req.session.user.id:',
      req.session.user.id,
      typeof req.session.user.id
    )
    console.log(
      '  Strict match (===):',
      project.user_id === req.session.user.id
    )
    console.log('  Loose match (==):', project.user_id === req.session.user.id)

    // Use loose equality to handle potential type mismatch
    if (project.user_id != req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json({
      id: project.id,
      name: project.name,
      transcript: project.transcript || '',
      summary: project.summary || '',
      tasks: project.tasks || [],
      meetings: project.meetings || [],
      createdAt: project.created_at,
      lastModified: project.updated_at
    })
  } catch (error) {
    console.error('[Projects] Get error:', error)
    res.status(500).json({ error: 'Failed to get project' })
  }
})

app.post('/api/projects', localAuth.requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    db.saveProject(userId, req.body)
    console.log('[Projects] Saved:', req.body.name, 'for user:', userId)
    res.json({ success: true, id: req.body.id })
  } catch (error) {
    console.error('[Projects] Save error:', error)
    res.status(500).json({ error: 'Failed to save project' })
  }
})

app.delete('/api/projects/:id', localAuth.requireAuth, (req, res) => {
  try {
    // Verify project belongs to user before deleting
    const project = db.getProject(req.params.id)
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    // Use loose equality to handle potential type mismatch
    if (project.user_id != req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    db.deleteProject(req.params.id)
    res.json({ success: true })
  } catch (error) {
    console.error('[Projects] Delete error:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

// Export all data
app.get('/api/export', localAuth.requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    const data = db.exportAll(userId)
    res.json(data)
  } catch (error) {
    console.error('[Export] Error:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// Meeting endpoints
app.post('/api/meetings', localAuth.requireAuth, (req, res) => {
  try {
    const { id, name, summary, transcript, createdAt, projectId } = req.body

    // Ensure meetings directory exists
    if (!fs.existsSync(MEETINGS_DIR)) {
      fs.mkdirSync(MEETINGS_DIR, { recursive: true })
    }

    // Create summary file
    const summaryFileName = `meeting-${id}-summary.md`
    const summaryFilePath = path.join(MEETINGS_DIR, summaryFileName)

    const summaryContent = `# ${name}

**Date:** ${new Date(createdAt).toLocaleDateString()}
**Time:** ${new Date(createdAt).toLocaleTimeString()}
**Project:** ${projectId || 'No project'}

---

${summary}

---

*Generated by Audio-to-Kanban App*
`

    fs.writeFileSync(summaryFilePath, summaryContent, 'utf8')
    console.log('[Meetings] Saved summary file:', summaryFileName)

    // Create transcript file (optional)
    let transcriptFilePath = null
    if (transcript && transcript.trim()) {
      const transcriptFileName = `meeting-${id}-transcript.txt`
      transcriptFilePath = path.join(MEETINGS_DIR, transcriptFileName)
      fs.writeFileSync(transcriptFilePath, transcript, 'utf8')
      console.log('[Meetings] Saved transcript file:', transcriptFileName)
    }

    // Save to database
    const userId = req.session.user.id
    db.saveMeeting(userId, {
      id,
      projectId,
      name,
      summaryFile: summaryFilePath,
      transcriptFile: transcriptFilePath
    })

    res.json({
      success: true,
      summaryFile: summaryFilePath,
      message: `Meeting "${name}" saved as file`
    })
  } catch (error) {
    console.error('[Meetings] Save error:', error)
    res.status(500).json({ error: 'Failed to save meeting' })
  }
})

app.get('/api/meetings/:id/summary', localAuth.requireAuth, (req, res) => {
  try {
    // Verify meeting belongs to user
    const meeting = db.getMeeting(req.params.id)
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }
    // Use loose equality to handle potential type mismatch
    if (meeting.user_id != req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const summaryFileName = `meeting-${req.params.id}-summary.md`
    const summaryFilePath = path.join(MEETINGS_DIR, summaryFileName)

    if (!fs.existsSync(summaryFilePath)) {
      return res.status(404).json({ error: 'Meeting summary not found' })
    }

    const content = fs.readFileSync(summaryFilePath, 'utf8')
    res.json({ content })
  } catch (error) {
    console.error('[Meetings] Get summary error:', error)
    res.status(500).json({ error: 'Failed to get meeting summary' })
  }
})

app.delete('/api/meetings/:id', localAuth.requireAuth, (req, res) => {
  try {
    const id = req.params.id

    // Get meeting info from database first
    const meeting = db.getMeeting(id)

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    // Verify meeting belongs to user (use loose equality)
    if (meeting.user_id != req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete files if they exist
    if (meeting.summary_file && fs.existsSync(meeting.summary_file)) {
      fs.unlinkSync(meeting.summary_file)
    }

    if (meeting.transcript_file && fs.existsSync(meeting.transcript_file)) {
      fs.unlinkSync(meeting.transcript_file)
    }

    // Delete from database
    db.deleteMeeting(id)

    res.json({ success: true })
  } catch (error) {
    console.error('[Meetings] Delete error:', error)
    res.status(500).json({ error: 'Failed to delete meeting files' })
  }
})

// Analytics insights caching endpoints
app.post('/api/analytics/insights', localAuth.requireAuth, async (req, res) => {
  try {
    const { projectId, insights, taskCount, timestamp } = req.body
    const userId = req.session.user.id

    // Save analytics insights to database
    db.saveAnalyticsInsights(userId, projectId, insights, taskCount, timestamp)

    res.json({ success: true })
  } catch (error) {
    console.error('[Analytics] Save insights error:', error)
    res.status(500).json({ error: 'Failed to save analytics insights' })
  }
})

app.get(
  '/api/analytics/insights/:projectId',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { projectId } = req.params
      const userId = req.session.user.id

      // Handle "all" projects case
      const actualProjectId = projectId === 'all' ? null : projectId

      const cached = db.getAnalyticsInsights(userId, actualProjectId)

      if (cached) {
        res.json(cached)
      } else {
        res.status(404).json({ error: 'No cached insights found' })
      }
    } catch (error) {
      console.error('[Analytics] Load insights error:', error)
      res.status(500).json({ error: 'Failed to load analytics insights' })
    }
  }
)

app.delete(
  '/api/analytics/insights/:projectId',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { projectId } = req.params
      const userId = req.session.user.id

      // Handle "all" projects case
      const actualProjectId = projectId === 'all' ? null : projectId

      db.clearAnalyticsInsights(userId, actualProjectId)

      res.json({ success: true })
    } catch (error) {
      console.error('[Analytics] Clear insights error:', error)
      res.status(500).json({ error: 'Failed to clear analytics insights' })
    }
  }
)

app.delete(
  '/api/analytics/insights',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const userId = req.session.user.id

      // Clear all analytics insights for user
      db.clearAllAnalyticsInsights(userId)

      res.json({ success: true })
    } catch (error) {
      console.error('[Analytics] Clear all insights error:', error)
      res.status(500).json({ error: 'Failed to clear all analytics insights' })
    }
  }
)

// Task change tracking endpoints
app.get(
  '/api/tasks/:taskId/changes',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { taskId } = req.params
      const { limit = 50 } = req.query

      // Get task info directly from database to verify access
      const taskInfo = dbInstance
        .prepare('SELECT project_id FROM tasks WHERE id = ?')
        .get(taskId)
      if (!taskInfo) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Get project to verify user access
      const project = db.getProject(taskInfo.project_id)
      if (!project || project.user_id != req.session.user.id) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const changes = db.getTaskChanges(taskId, parseInt(limit))
      res.json(changes)
    } catch (error) {
      console.error('[Task Changes] Get changes error:', error)
      res.status(500).json({ error: 'Failed to get task changes' })
    }
  }
)

app.get(
  '/api/projects/:projectId/changes',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { projectId } = req.params
      const { limit = 100 } = req.query

      // Verify project access
      const project = db.getProject(projectId)
      if (!project || project.user_id != req.session.user.id) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const changes = db.getProjectTaskChanges(projectId, parseInt(limit))
      res.json(changes)
    } catch (error) {
      console.error('[Project Changes] Get changes error:', error)
      res.status(500).json({ error: 'Failed to get project changes' })
    }
  }
)

// Task comments endpoints
app.get(
  '/api/tasks/:taskId/comments',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { taskId } = req.params
      const { limit = 50 } = req.query

      // Get task info directly from database to verify access
      const taskInfo = dbInstance
        .prepare('SELECT project_id FROM tasks WHERE id = ?')
        .get(taskId)
      if (!taskInfo) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Get project to verify user access
      const project = db.getProject(taskInfo.project_id)
      if (!project || project.user_id != req.session.user.id) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const comments = db.getTaskComments(taskId, parseInt(limit))
      res.json(comments)
    } catch (error) {
      console.error('[Task Comments] Get comments error:', error)
      res.status(500).json({ error: 'Failed to get task comments' })
    }
  }
)

app.post(
  '/api/tasks/:taskId/comments',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { taskId } = req.params
      const { content, commentType = 'user', metadata = null } = req.body
      const userId = req.session.user.id
      const user = req.session.user

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' })
      }

      // Get task info directly from database to verify access
      const taskInfo = dbInstance
        .prepare('SELECT project_id FROM tasks WHERE id = ?')
        .get(taskId)
      if (!taskInfo) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Get project to verify user access
      const project = db.getProject(taskInfo.project_id)
      if (!project || project.user_id != userId) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // Generate comment ID
      const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Add comment
      db.addTaskComment(
        commentId,
        taskId,
        userId,
        user.name || user.email,
        content.trim(),
        commentType,
        metadata
      )

      // Record change if it's an AI update
      if (commentType === 'ai_update') {
        db.recordTaskChange(
          taskId,
          userId,
          'ai_comment_added',
          null,
          null,
          content.trim(),
          {
            commentId,
            commentType: 'ai_update'
          }
        )
      }

      res.json({ id: commentId, success: true })
    } catch (error) {
      console.error('[Task Comments] Add comment error:', error)
      res.status(500).json({ error: 'Failed to add comment' })
    }
  }
)

app.put('/api/comments/:commentId', localAuth.requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' })
    }

    const result = db.updateTaskComment(commentId, content.trim())

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ error: 'Comment not found or access denied' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('[Task Comments] Update comment error:', error)
    res.status(500).json({ error: 'Failed to update comment' })
  }
})

app.delete(
  '/api/comments/:commentId',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { commentId } = req.params
      const userId = req.session.user.id

      const result = db.deleteTaskComment(commentId, userId)

      if (result.changes === 0) {
        return res
          .status(404)
          .json({ error: 'Comment not found or access denied' })
      }

      res.json({ success: true })
    } catch (error) {
      console.error('[Task Comments] Delete comment error:', error)
      res.status(500).json({ error: 'Failed to delete comment' })
    }
  }
)

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API running on http://0.0.0.0:${PORT}`)
  console.log('[Server] Using SQLite database')
})
