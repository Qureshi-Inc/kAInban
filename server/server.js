import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import connectSqlite3 from 'connect-sqlite3'
import cors from 'cors'
import express from 'express'
import expressRateLimit from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import morgan from 'morgan'
import multer from 'multer'
import * as aiProvider from './aiProviderService.js'
import * as db from './database.js'
import dbInstance from './database.js'
import * as localAuth from './localAuth.js'
import * as oidcAuth from './oidcAuth.js'
import tenantService from './tenantService.js'

// Tenant middleware - extract and attach tenant context to requests
const attachTenantContext = async (req, res, next) => {
  try {
    console.log('[Middleware] Starting tenant context extraction')
    if (tenantService.isEnabled()) {
      const tenant = await tenantService.extractTenantFromRequest(req)
      if (tenant) {
        req.tenant = tenant
        console.log(
          '[Middleware] Tenant context attached:',
          tenant.subdomain,
          'ID:',
          tenant.id
        )
      } else {
        console.log('[Middleware] No tenant context found')
      }
    } else {
      console.log('[Middleware] Multi-tenancy not enabled')
    }
    next()
  } catch (error) {
    console.error('[Middleware] Tenant context error:', error)
    next() // Continue without tenant context
  }
}
import recaptchaService from './recaptchaService.js'

const app = express()
const PORT = process.env.PORT || 3001
const STORAGE_DIR = process.env.STORAGE_DIR || './storage'
const MEETINGS_DIR = path.join(STORAGE_DIR, 'meetings')
const SQLiteStore = connectSqlite3(session)
const aiUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024
  }
})

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
        connectSrc: ["'self'"],
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
const globalLimiter = expressRateLimit({
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
// Body parsers. JSON only - dropped urlencoded to neutralize the form-CSRF
// vector (a cross-origin <form method="POST"> can't make the server parse
// JSON without a CORS preflight). 2mb is plenty for project/task payloads.
// AI audio uploads use a dedicated multipart route (/api/ai/transcribe).
app.use(express.json({ limit: '2mb' }))
app.use(morgan('combined')) // Changed to combined for better security logging

// Session secret must be set explicitly in production. Falling back to a
// hardcoded literal silently signs every cookie with a public string and is
// trivially exploitable. Refuse to boot rather than ship insecure.
const SESSION_SECRET = process.env.SESSION_SECRET
if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] SESSION_SECRET is required in production')
    process.exit(1)
  }
  console.warn(
    '[Server] SESSION_SECRET not set - using ephemeral random value (DEV ONLY)'
  )
}

// Session middleware
app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: STORAGE_DIR
    }),
    secret: SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
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

// Rate limiting for auth endpoints - TEMPORARILY DISABLED FOR TESTING
const authLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased from 5 to 100 requests per window
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
})

// signupLimiter removed in Phase 6 - the PocketID intent-creation/magic-link
// endpoints it gated were deleted. The local /api/auth/register fallback uses
// authLimiter instead.

// Local-auth fallback gates. Default off: production routes go through
// Zitadel hosted login. Set LOCAL_LOGIN_FALLBACK=true (or LOCAL_REGISTER_FALLBACK=true)
// to re-open the local endpoints during a rollback. They're split so that
// re-enabling login for an emergency does not also re-open registration.
const requireLocalLoginFallback = (req, res, next) => {
  if (process.env.LOCAL_LOGIN_FALLBACK !== 'true') {
    return res.status(410).json({
      error: 'Local login is disabled. Use /api/auth/oidc/login (Zitadel).'
    })
  }
  next()
}
const requireLocalRegisterFallback = (req, res, next) => {
  if (process.env.LOCAL_REGISTER_FALLBACK !== 'true') {
    return res.status(410).json({
      error: 'Local registration is disabled. Sign up via Zitadel hosted UI.'
    })
  }
  next()
}

// OIDC token refresh middleware. Runs before authenticated routes; if the
// session's access token is within 5 minutes of expiry, refresh transparently
// using the refresh token. A process-local Map<sessionID, Promise> mutex
// ensures concurrent requests for the same session collapse onto one refresh
// (Zitadel rotates refresh tokens, so racing refreshes invalidate each other).
//
// Failures fall through with the existing access token rather than 401-ing -
// transient blips shouldn't log users out. The next request will retry.
const refreshLocks = new Map()

app.use(async (req, res, next) => {
  try {
    const oidcSession = req.session?.oidc
    if (!oidcSession?.refresh_token || !oidcSession?.expires_at) {
      return next()
    }
    const nowSec = Math.floor(Date.now() / 1000)
    const marginSec = 5 * 60
    if (oidcSession.expires_at - nowSec > marginSec) {
      return next()
    }

    const sid = req.sessionID
    if (refreshLocks.has(sid)) {
      try {
        await refreshLocks.get(sid)
      } catch (_e) {
        // Inflight refresh failed; we'll fall through with current token.
      }
      // Reload session so this request sees the refreshed tokens.
      return req.session.reload(reloadErr => {
        if (reloadErr) {
          console.warn(
            '[OIDC] session.reload after refresh failed:',
            reloadErr.message
          )
        }
        next()
      })
    }

    const refreshPromise = (async () => {
      console.log('[OIDC] Refreshing access token for session', sid)
      const newTokenSet = await oidcAuth.refreshTokenSet(
        oidcSession.refresh_token
      )
      req.session.oidc = {
        id_token: newTokenSet.id_token || oidcSession.id_token,
        refresh_token: newTokenSet.refresh_token || oidcSession.refresh_token,
        expires_at: newTokenSet.expires_at || oidcSession.expires_at,
        refreshing: false
      }
      await new Promise((resolve, reject) => {
        req.session.save(err => (err ? reject(err) : resolve()))
      })
    })()
    refreshLocks.set(sid, refreshPromise)
    try {
      await refreshPromise
    } catch (err) {
      console.warn(
        '[OIDC] token refresh failed (falling through):',
        err.message
      )
    } finally {
      refreshLocks.delete(sid)
    }
    next()
  } catch (err) {
    console.warn(
      '[OIDC] refresh middleware error (falling through):',
      err.message
    )
    next()
  }
})

// Note: CSRF token endpoint disabled for MVP
// app.get('/api/csrf-token', (req, res) => {
//   res.json({ csrfToken: 'disabled-for-mvp' })
// })

// Health check. Actually pings the DB rather than blindly claiming it's
// connected - a corrupted/locked DB would now return 503 here, letting
// orchestrators replace the container.
app.get('/health', (req, res) => {
  try {
    dbInstance.prepare('SELECT 1').get()
    res.json({ status: 'ok', database: 'connected' })
  } catch (err) {
    res
      .status(503)
      .json({ status: 'unhealthy', database: 'error', error: err.message })
  }
})

// Separate OIDC dependency healthcheck. Kept off the main /health so a
// Zitadel blip doesn't take api out of the LB pool for non-auth traffic.
app.get('/health/oidc', async (req, res) => {
  if (!oidcAuth.isOIDCEnabled()) {
    return res
      .status(503)
      .json({ status: 'disabled', reason: 'OIDC env not configured' })
  }
  const issuer = process.env.ZITADEL_ISSUER
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 2000)
  try {
    const r = await fetch(`${issuer}/.well-known/openid-configuration`, {
      signal: ctrl.signal
    })
    clearTimeout(timeout)
    if (!r.ok) {
      return res.status(503).json({ status: 'unreachable', http: r.status })
    }
    return res.json({ status: 'ok', issuer })
  } catch (err) {
    clearTimeout(timeout)
    return res.status(503).json({ status: 'unreachable', error: err.message })
  }
})

// Multi-tenancy configuration endpoint
app.get('/api/config/multitenancy', (req, res) => {
  res.json({
    enabled: tenantService.isEnabled(),
    registrationEnabled: process.env.ALLOW_REGISTRATION === 'true'
  })
})

// reCAPTCHA configuration endpoint
app.get('/api/config/recaptcha', (req, res) => {
  res.json(recaptchaService.getConfig())
})

// Get current tenant information
app.get('/api/tenant/info', localAuth.requireAuth, async (req, res) => {
  try {
    if (!tenantService.isEnabled()) {
      return res.status(404).json({ error: 'Multi-tenancy not enabled' })
    }

    // Extract tenant from request
    const tenant = await tenantService.extractTenantFromRequest(req)

    if (!tenant) {
      return res.status(404).json({ error: 'No tenant found' })
    }

    // Get tenant statistics
    const stats = await tenantService.getTenantStats(tenant.id)

    res.json({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.plan,
      maxUsers: tenant.max_users,
      active: tenant.active,
      createdAt: tenant.created_at,
      stats
    })
  } catch (error) {
    console.error('[Tenant] Get info error:', error)
    res.status(500).json({ error: 'Failed to get tenant information' })
  }
})

// Legacy tenant path routing (redirect to query parameter)
app.get('/tenant/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params
    // Redirect to query parameter format
    res.redirect(`/?tenant=${subdomain}`)
  } catch (error) {
    console.error('[Tenant] Legacy routing error:', error)
    res.status(500).send('Error accessing tenant')
  }
})

// Authentication endpoints (LOCAL FALLBACK ONLY - Zitadel handles registration via hosted UI)
app.post(
  '/api/auth/register',
  requireLocalRegisterFallback,
  authLimiter,
  async (req, res) => {
    try {
      const {
        email,
        password,
        name,
        tenantName,
        subdomain,
        tier,
        recaptchaToken
      } = req.body

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

      // Verify reCAPTCHA if enabled
      if (recaptchaService.isEnabled()) {
        const recaptchaResult = await recaptchaService.verifyToken(
          recaptchaToken,
          req.ip
        )
        if (!recaptchaResult.success) {
          console.log(
            '[Auth] reCAPTCHA verification failed:',
            recaptchaResult.error
          )
          return res.status(400).json({
            error:
              recaptchaResult.error ||
              'reCAPTCHA verification failed. Please try again.'
          })
        }
        console.log(
          '[Auth] reCAPTCHA verified with score:',
          recaptchaResult.score
        )
      }

      let tenant = null
      let user = null

      // Every user gets their own tenant
      if (tenantService.isEnabled()) {
        console.log('[Auth] Creating tenant for user:', {
          email,
          tenantName,
          tier
        })

        // Create tenant first - use organization name or email as fallback
        try {
          const tierLimits = {
            starter: { maxUsers: 5 },
            professional: { maxUsers: 25 },
            enterprise: { maxUsers: 100 }
          }

          const maxUsers = tierLimits[tier]?.maxUsers || 5
          const orgName = tenantName || email.split('@')[0]
          const subdomain = orgName.toLowerCase().replace(/[^a-z0-9]/g, '')

          tenant = await tenantService.createTenant({
            name: orgName,
            subdomain,
            plan: tier || 'starter',
            maxUsers
          })

          console.log('[Auth] Created tenant:', tenant.id)
        } catch (error) {
          return res.status(400).json({ error: error.message })
        }

        // Register user with tenant
        user = await localAuth.registerUser({
          email,
          password,
          name,
          tenantId: tenant.id
        })

        // Associate user with tenant
        await tenantService.addUserToTenant(user.id, tenant.id)
      } else {
        // Single-tenant registration (existing flow)
        user = await localAuth.registerUser({ email, password, name })
      }

      // Regenerate session ID before assigning user to prevent session fixation
      await new Promise((resolve, reject) => {
        req.session.regenerate(err => (err ? reject(err) : resolve()))
      })

      req.session.user = localAuth.formatUserForSession(user)

      // Explicitly save session
      req.session.save(err => {
        if (err) {
          console.error('[Auth] Session save error:', err)
          return res.status(500).json({ error: 'Failed to create session' })
        }
        console.log('[Auth] User registered and logged in:', user.email)

        const response = {
          success: true,
          user: req.session.user
        }

        // Include tenant info in response for multi-tenant setup
        if (tenant) {
          response.tenant = {
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            plan: tenant.plan
          }
        }

        res.json(response)
      })
    } catch (error) {
      console.error('[Auth] Registration error:', error.message)
      res.status(400).json({ error: error.message })
    }
  }
)

app.post(
  '/api/auth/login',
  requireLocalLoginFallback,
  authLimiter,
  async (req, res) => {
    try {
      const { email, password } = req.body

      // Authenticate user
      const user = await localAuth.authenticateUser(email, password)

      // Get user's tenant information for redirect
      let userTenant = null
      if (tenantService.isEnabled() && user.tenant_id) {
        try {
          userTenant = await tenantService.getTenantById(user.tenant_id)
          console.log('[Auth] User tenant found:', userTenant?.subdomain)
        } catch (error) {
          console.error('[Auth] Error getting user tenant:', error)
        }
      }

      // Regenerate session ID before assigning user to prevent session fixation
      await new Promise((resolve, reject) => {
        req.session.regenerate(err => (err ? reject(err) : resolve()))
      })

      req.session.user = localAuth.formatUserForSession(user)

      // Explicitly save session
      req.session.save(err => {
        if (err) {
          console.error('[Auth] Session save error:', err)
          return res.status(500).json({ error: 'Failed to create session' })
        }
        console.log('[Auth] User logged in:', user.email)

        const response = {
          success: true,
          user: req.session.user
        }

        // Include tenant redirect URL if user has a tenant
        if (userTenant) {
          response.redirectUrl = `/?tenant=${userTenant.subdomain}`
          console.log('[Auth] User should redirect to:', response.redirectUrl)
        }

        res.json(response)
      })
    } catch (error) {
      console.error('[Auth] Login error:', error.message)
      res.status(401).json({ error: error.message })
    }
  }
)

app.post('/api/auth/logout', async (req, res) => {
  const userEmail = req.session?.user?.email
  const oidcSession = req.session?.oidc

  // Best-effort revocation at Zitadel BEFORE destroying local session, so the
  // refresh token can't be used even if the SQLite session DB is later leaked.
  if (oidcSession?.refresh_token) {
    await oidcAuth.revokeRefreshToken(oidcSession.refresh_token)
  }

  // Compute the Zitadel end_session URL while id_token is still in scope.
  let endSessionUrl = null
  if (oidcSession?.id_token && oidcAuth.isOIDCEnabled()) {
    try {
      endSessionUrl = await oidcAuth.getEndSessionUrl({
        idTokenHint: oidcSession.id_token,
        postLogoutRedirectUri: process.env.APP_URL || undefined
      })
    } catch (err) {
      console.warn(
        '[Auth] getEndSessionUrl failed (continuing with local logout):',
        err.message
      )
    }
  }

  req.session.destroy(err => {
    if (err) {
      console.error('[Auth] Logout error:', err)
      return res.status(500).json({ error: 'Failed to logout' })
    }
    res.clearCookie('notes.sid')
    console.log('[Auth] User logged out:', userEmail)
    if (endSessionUrl) {
      return res.json({ success: true, redirectUrl: endSessionUrl })
    }
    res.json({ success: true })
  })
})

app.get('/api/auth/me', (req, res) => {
  // No-logging-by-default: this endpoint runs on every page load and previously
  // emitted session IDs + cookie state to logs. If you need debug visibility,
  // set DEBUG_AUTH_ME=true in env to opt back in.
  if (process.env.DEBUG_AUTH_ME === 'true') {
    console.log('[Auth] /me user:', req.session?.user?.email || 'none')
  }
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

// OIDC Authentication endpoints (Zitadel)
//
// Config is now env-driven (ZITADEL_ISSUER, ZITADEL_CLIENT_ID, OIDC_CALLBACK_URL)
// rather than DB-stored, so deploy is atomic and there's no admin-UI step.
// The /config endpoint is retained for back-compat but reports readonly.
app.get('/api/auth/oidc/config', localAuth.requireAuth, (req, res) => {
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  // PKCE public client - clientId is non-sensitive (visible in browser
  // during the authorize redirect). No client_secret to expose.
  res.json({
    enabled: oidcAuth.isOIDCEnabled(),
    provider: 'zitadel',
    issuer: process.env.ZITADEL_ISSUER || null,
    clientId: process.env.ZITADEL_CLIENT_ID || null,
    callbackUrl: process.env.OIDC_CALLBACK_URL || null,
    bootstrapAdminEmails: (process.env.ZITADEL_BOOTSTRAP_ADMIN_EMAILS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    readonly: true
  })
})

app.get('/api/auth/oidc/status', (req, res) => {
  res.json({
    enabled: oidcAuth.isOIDCEnabled(),
    issuer: process.env.ZITADEL_ISSUER || null
  })
})

// 302-redirect directly to Zitadel hosted login. Frontend is a plain
// <a href="/api/auth/oidc/login"> - no fetch/JSON intermediary.
app.get('/api/auth/oidc/login', authLimiter, async (req, res) => {
  try {
    if (!oidcAuth.isOIDCEnabled()) {
      return res.status(400).json({ error: 'OIDC is not enabled' })
    }

    const { authUrl, codeVerifier, state, nonce } =
      await oidcAuth.getAuthorizationUrl()

    req.session.oidcCodeVerifier = codeVerifier
    req.session.oidcState = state
    req.session.oidcNonce = nonce

    req.session.save(err => {
      if (err) {
        console.error('[OIDC] Session save error:', err)
        return res.status(500).json({ error: 'Failed to create OIDC session' })
      }
      res.redirect(authUrl)
    })
  } catch (error) {
    console.error('[OIDC] Login error:', error)
    res.status(500).json({ error: 'Failed to initiate OIDC login' })
  }
})

app.get('/api/auth/oidc/callback', authLimiter, async (req, res) => {
  const frontendUrl = process.env.APP_URL || '/'
  const errorRedirect = msg =>
    res.redirect(`${frontendUrl}?oidc_error=${encodeURIComponent(msg)}`)

  try {
    const codeVerifier = req.session.oidcCodeVerifier
    const state = req.session.oidcState
    const nonce = req.session.oidcNonce

    if (!codeVerifier || !state) {
      return errorRedirect('Invalid OIDC session - try signing in again')
    }
    if (!oidcAuth.isOIDCEnabled()) {
      return errorRedirect('OIDC is not enabled')
    }

    const callbackUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    const { tokenSet, userinfo } = await oidcAuth.handleCallback(
      callbackUrl,
      codeVerifier,
      state,
      nonce
    )

    const issuer = process.env.ZITADEL_ISSUER
    const user = oidcAuth.findOrCreateOIDCUser(userinfo, issuer)

    // Regenerate session ID before assigning user (prevents session fixation).
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => (err ? reject(err) : resolve()))
    })

    req.session.user = oidcAuth.formatUserForSession(user)
    req.session.oidc = {
      id_token: tokenSet.id_token,
      refresh_token: tokenSet.refresh_token || null,
      expires_at: tokenSet.expires_at || null,
      refreshing: false
    }

    req.session.save(err => {
      if (err) {
        console.error('[OIDC] Session save error:', err)
        return errorRedirect('Failed to create session')
      }
      console.log('[OIDC] User logged in:', user.email)
      res.redirect(`${frontendUrl}?oidc_success=true`)
    })
  } catch (error) {
    console.error('[OIDC] Callback error:', error)
    return errorRedirect(error.message || 'OIDC callback failed')
  }
})

// PocketID signup-intent / magic-link endpoints removed in the Phase 6
// cleanup. Signup flows through the Zitadel hosted UI now; the rollback
// path keeps /api/auth/register only (gated behind LOCAL_REGISTER_FALLBACK).

// Invite endpoints
app.post(
  '/api/invites/create',
  localAuth.requireAuth,
  attachTenantContext,
  async (req, res) => {
    try {
      const { email, role = 'user' } = req.body
      const userId = req.session.user.id
      const tenantId = req.tenant?.id

      console.log('[Invite] Debug - req.tenant:', req.tenant)
      console.log('[Invite] Debug - tenantId:', tenantId)
      console.log('[Invite] Debug - userId:', userId)

      if (!tenantId) {
        return res
          .status(400)
          .json({ error: 'Multi-tenancy not enabled or no tenant context' })
      }

      if (!email || !localAuth.validateEmail(email).valid) {
        return res.status(400).json({ error: 'Valid email is required' })
      }

      // Check if user already exists in this tenant
      const existingUser = db.getUserByEmailAndTenant(email, tenantId)
      if (existingUser) {
        return res
          .status(400)
          .json({ error: 'User already exists in this tenant' })
      }

      // Generate secure token (was require('crypto') - broken in ESM)
      const tokenId = `invite_${crypto.randomUUID()}`
      const token = crypto.randomBytes(32).toString('hex')

      // Set expiration to 7 days from now
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString()

      const tokenData = {
        id: tokenId,
        token,
        tenant_id: tenantId,
        inviter_id: userId,
        invitee_email: email.toLowerCase(),
        role,
        expires_at: expiresAt
      }

      const created = db.createInviteToken(tokenData)
      if (!created) {
        return res.status(500).json({ error: 'Failed to create invite' })
      }

      // Generate invite URL
      const baseUrl =
        process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
      const inviteUrl = `${baseUrl}/invite/${token}`

      res.json({
        success: true,
        inviteUrl,
        expiresAt,
        message: `Invite sent to ${email}`
      })
    } catch (error) {
      console.error('[Invite] Create error:', error)
      res.status(500).json({ error: 'Failed to create invite' })
    }
  }
)

app.get('/api/invites/validate/:token', async (req, res) => {
  try {
    const { token } = req.params
    const inviteData = db.getInviteTokenByToken(token)

    if (!inviteData) {
      return res.status(404).json({ error: 'Invite not found or expired' })
    }

    res.json({
      valid: true,
      tenantName: inviteData.tenant_name,
      inviterName: inviteData.inviter_name,
      inviterEmail: inviteData.inviter_email,
      role: inviteData.role,
      expiresAt: inviteData.expires_at
    })
  } catch (error) {
    console.error('[Invite] Validate error:', error)
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

app.post('/api/invites/accept/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { name, email, password } = req.body

    // Validate invite token
    const inviteData = db.getInviteTokenByToken(token)
    if (!inviteData) {
      return res.status(404).json({ error: 'Invite not found or expired' })
    }

    // Validate email matches invite
    if (email.toLowerCase() !== inviteData.invitee_email) {
      return res.status(400).json({ error: 'Email does not match invite' })
    }

    // Validate user input
    const emailValidation = localAuth.validateEmail(email)
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error })
    }

    const passwordValidation = localAuth.validatePassword(password)
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error })
    }

    // Check if user already exists globally
    const existingUser = db.getUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2)}`
    const hashedPassword = await localAuth.hashPassword(password)

    const userData = {
      id: userId,
      email: emailValidation.normalized,
      name: name.trim(),
      password: hashedPassword,
      role: inviteData.role,
      tenant_id: inviteData.tenant_id
    }

    const userCreated = db.createUser(userData)
    if (!userCreated) {
      return res.status(500).json({ error: 'Failed to create user' })
    }

    // Mark invite as used
    db.markInviteTokenUsed(token, userId)

    // Create session
    req.session.userId = userId
    req.session.userEmail = userData.email
    req.session.userRole = userData.role
    req.session.tenantId = inviteData.tenant_id

    // Get full user data
    const user = db.getUserById(userId)

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id
      },
      message: 'Successfully joined tenant'
    })
  } catch (error) {
    console.error('[Invite] Accept error:', error)
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

app.get(
  '/api/invites/list',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
    try {
      const tenantId = req.tenant?.id

      if (!tenantId) {
        return res.status(400).json({ error: 'No tenant context' })
      }

      const invites = db.getInviteTokensForTenant(tenantId)
      res.json(invites)
    } catch (error) {
      console.error('[Invite] List error:', error)
      res.status(500).json({ error: 'Failed to list invites' })
    }
  }
)

// Settings endpoints
app.get(
  '/api/settings',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
    try {
      const userId = req.session.user.id
      // Security-first: never send provider secrets (api keys) to the browser.
      // The frontend now calls server-side /api/ai/* proxy endpoints.
      res.json(aiProvider.getClientSafeAiSettings(userId))
    } catch (error) {
      console.error('[Settings] Get error:', error)
      res.status(500).json({ error: 'Failed to get settings' })
    }
  }
)

app.post(
  '/api/settings',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
    try {
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      const userId = req.session.user.id
      const payload = { ...req.body }
      const existing = db.getSettings(userId)
      const providedApiKey =
        typeof payload.apiKey === 'string' ? payload.apiKey.trim() : ''

      // Keep the currently stored secret unless the admin explicitly provides
      // a replacement key or asks to clear it.
      if (payload.clearApiKey === true) {
        payload.apiKey = ''
      } else if (!providedApiKey) {
        payload.apiKey = existing?.api_key || ''
      } else {
        payload.apiKey = providedApiKey
      }

      db.saveSettings(userId, payload)
      console.log('[Settings] Saved successfully for user:', userId)
      res.json({ success: true })
    } catch (error) {
      console.error('[Settings] Save error:', error)
      res.status(500).json({ error: 'Failed to save settings' })
    }
  }
)

app.post('/api/ai/test-connection', localAuth.requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const userId = req.session.user.id
    const result = await aiProvider.testConnection(userId, req.body || {})
    return res.json({ success: true, provider: result.provider })
  } catch (error) {
    console.error('[AI] Test connection error:', error.message)
    return res
      .status(400)
      .json({ error: error.message || 'Connection test failed' })
  }
})

app.post('/api/ai/chat', localAuth.requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id
    const result = await aiProvider.createChatCompletion(userId, req.body || {})
    return res.json(result)
  } catch (error) {
    console.error('[AI] Chat proxy error:', error.message)
    return res
      .status(400)
      .json({ error: error.message || 'Chat completion failed' })
  }
})

app.post(
  '/api/ai/transcribe',
  localAuth.requireAuth,
  aiUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' })
      }

      const userId = req.session.user.id
      const text = await aiProvider.transcribeAudio(userId, {
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        language: req.body?.language,
        responseFormat: req.body?.response_format,
        model: req.body?.model
      })

      return res.json({ text })
    } catch (error) {
      console.error('[AI] Transcription proxy error:', error.message)
      return res
        .status(400)
        .json({ error: error.message || 'Transcription failed' })
    }
  }
)

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
app.get(
  '/api/projects',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
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
  }
)

app.get(
  '/api/projects/:id',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
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
      console.log(
        '  Loose match (==):',
        project.user_id === String(req.session.user.id)
      )

      // Use loose equality to handle potential type mismatch
      if (project.user_id !== String(req.session.user.id)) {
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
  }
)

app.post(
  '/api/projects',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
    try {
      const userId = req.session.user.id
      db.saveProject(userId, req.body)
      console.log('[Projects] Saved:', req.body.name, 'for user:', userId)
      res.json({ success: true, id: req.body.id })
    } catch (error) {
      console.error('[Projects] Save error:', error)
      res.status(500).json({ error: 'Failed to save project' })
    }
  }
)

app.delete(
  '/api/projects/:id',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
    try {
      // Verify project belongs to user before deleting
      const project = db.getProject(req.params.id)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      // Use loose equality to handle potential type mismatch
      if (project.user_id !== String(req.session.user.id)) {
        return res.status(403).json({ error: 'Access denied' })
      }

      db.deleteProject(req.params.id)
      res.json({ success: true })
    } catch (error) {
      console.error('[Projects] Delete error:', error)
      res.status(500).json({ error: 'Failed to delete project' })
    }
  }
)

// Delete all projects for current user
app.delete(
  '/api/projects',
  localAuth.requireAuth,
  attachTenantContext,
  (req, res) => {
    try {
      console.log(
        '[Projects] Deleting all projects for user:',
        req.session.user.id
      )
      db.deleteAllProjects(req.session.user.id)
      res.json({ success: true, message: 'All projects deleted successfully' })
    } catch (error) {
      console.error('[Projects] Delete all error:', error)
      res.status(500).json({ error: 'Failed to delete all projects' })
    }
  }
)

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

// Meeting ID format. Used both to generate a server-side ID and to validate
// any caller-supplied one (the meeting ID becomes part of a filename, so
// allowing arbitrary characters lets a caller traverse out of MEETINGS_DIR).
const MEETING_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/
const MEETINGS_DIR_RESOLVED = path.resolve(MEETINGS_DIR)
function safeMeetingPath(filename) {
  const resolved = path.resolve(path.join(MEETINGS_DIR_RESOLVED, filename))
  if (
    !resolved.startsWith(MEETINGS_DIR_RESOLVED + path.sep) &&
    resolved !== MEETINGS_DIR_RESOLVED
  ) {
    throw new Error('Path traversal attempt detected: ' + filename)
  }
  return resolved
}

// Meeting endpoints
app.post('/api/meetings', localAuth.requireAuth, (req, res) => {
  try {
    const { id, name, summary, transcript, createdAt, projectId } = req.body
    const userId = req.session.user.id

    // Validate the caller-supplied meeting id (used in filenames). Reject
    // anything that isn't safe; the regex blocks ../, slashes, null bytes etc.
    if (!id || !MEETING_ID_REGEX.test(String(id))) {
      return res.status(400).json({
        error: 'Invalid meeting id - must match ^[A-Za-z0-9_-]{1,64}$'
      })
    }

    // Verify caller owns the project they're attaching this meeting to.
    // Without this check, user A can attach (attacker-controlled) meetings
    // under user B's project and B will see them on next load.
    if (projectId) {
      const project = db.getProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      if (project.user_id !== String(userId)) {
        return res.status(403).json({ error: 'Forbidden - not your project' })
      }
    }

    // Ensure meetings directory exists
    if (!fs.existsSync(MEETINGS_DIR)) {
      fs.mkdirSync(MEETINGS_DIR, { recursive: true })
    }

    // Create summary file (path containment-checked as belt-and-suspenders)
    const summaryFileName = `meeting-${id}-summary.md`
    const summaryFilePath = safeMeetingPath(summaryFileName)

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
      transcriptFilePath = safeMeetingPath(transcriptFileName)
      fs.writeFileSync(transcriptFilePath, transcript, 'utf8')
      console.log('[Meetings] Saved transcript file:', transcriptFileName)
    }

    // Save to database (userId already declared at top of handler)
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
    if (!MEETING_ID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid meeting id' })
    }
    // Verify meeting belongs to user
    const meeting = db.getMeeting(req.params.id)
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }
    // Use loose equality to handle potential type mismatch
    if (meeting.user_id !== String(req.session.user.id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const summaryFileName = `meeting-${req.params.id}-summary.md`
    const summaryFilePath = safeMeetingPath(summaryFileName)

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

    if (!MEETING_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid meeting id' })
    }

    // Get meeting info from database first
    const meeting = db.getMeeting(id)

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    // Verify meeting belongs to user (use loose equality)
    if (meeting.user_id !== String(req.session.user.id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete files if they exist. Re-validate stored paths are under
    // MEETINGS_DIR before unlinking - defense against any historical row
    // that may have a tampered path.
    const safeUnlink = filePath => {
      if (!filePath) {
        return
      }
      try {
        const resolved = path.resolve(filePath)
        if (
          (resolved.startsWith(MEETINGS_DIR_RESOLVED + path.sep) ||
            resolved === MEETINGS_DIR_RESOLVED) &&
          fs.existsSync(resolved)
        ) {
          fs.unlinkSync(resolved)
        }
      } catch (e) {
        console.warn(
          '[Meetings] Skipped unsafe file unlink:',
          filePath,
          e.message
        )
      }
    }
    safeUnlink(meeting.summary_file)
    safeUnlink(meeting.transcript_file)

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

    // Verify caller owns the project they're caching insights for. Without
    // this check, user A can write attacker-controlled insights under user B's
    // project and B will see them on next read.
    if (projectId) {
      const project = db.getProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      if (project.user_id !== String(userId)) {
        return res.status(403).json({ error: 'Forbidden - not your project' })
      }
    }

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
      if (!project || project.user_id !== String(req.session.user.id)) {
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
      if (!project || project.user_id !== String(req.session.user.id)) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const changes = db.getProjectTaskChanges(projectId, parseInt(limit))

      // Prevent caching of activity data since it changes frequently
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      })

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
      if (!project || project.user_id !== String(req.session.user.id)) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const comments = db.getTaskComments(taskId, parseInt(limit))

      // Prevent caching of comment data since it changes frequently
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      })

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
      const userId = String(Math.floor(parseFloat(req.session.user.id)))
      const user = req.session.user

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' })
      }

      // Get task info directly from database to verify access
      const taskInfo = dbInstance
        .prepare('SELECT project_id, title FROM tasks WHERE id = ?')
        .get(taskId)
      if (!taskInfo) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Get project to verify user access
      const project = db.getProject(taskInfo.project_id)
      if (!project || project.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // Generate comment ID
      const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Add comment with proper error handling
      const authorName =
        commentType === 'ai_update' ? 'AI Coordinator' : user.name || user.email

      console.log('[Task Comments] Adding comment:', {
        commentId,
        taskId,
        userId,
        authorName,
        commentType,
        contentLength: content.trim().length
      })

      const commentResult = db.addTaskComment(
        commentId,
        taskId,
        userId,
        authorName,
        content.trim(),
        commentType,
        metadata
      )

      console.log('[Task Comments] Comment result:', commentResult)

      if (!commentResult || commentResult.changes === 0) {
        throw new Error('Failed to insert comment - no rows affected')
      }

      // Record change for both AI and user comments
      if (commentType === 'ai_update') {
        console.log('[Task Comments] Recording activity for AI update')
        db.recordTaskChange(
          taskId,
          userId,
          'ai_comment_added',
          null,
          null,
          content.trim(),
          {
            commentId,
            commentType: 'ai_update',
            authorName: 'AI Coordinator',
            taskTitle: taskInfo.title,
            taskId: taskId,
            projectId: taskInfo.project_id,
            userId: userId,
            source: 'ai_comment'
          }
        )
      } else if (commentType === 'user') {
        console.log('[Task Comments] Recording activity for user comment')
        db.recordTaskChange(
          taskId,
          userId,
          'user_comment_added',
          null,
          null,
          content.trim(),
          {
            commentId,
            commentType: 'user',
            authorName,
            taskTitle: taskInfo.title,
            taskId: taskId,
            projectId: taskInfo.project_id,
            userEmail: user.email,
            userId: userId,
            source: 'manual_comment'
          }
        )
      }

      console.log('[Task Comments] ✓ Comment added successfully:', commentId)

      // Small delay to prevent race condition with project save
      await new Promise(resolve => setTimeout(resolve, 100))

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
    const userId = req.session.user.id

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' })
    }

    // Verify ownership before update. Previously this endpoint allowed any
    // authenticated user to rewrite any comment given a (predictable) ID.
    const existing = db.getTaskComment(commentId)
    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' })
    }
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden - not your comment' })
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

// Get single comment by ID (for activity display). Ownership-checked: a
// comment is visible only to the user who wrote it. Wider visibility (e.g.
// to other collaborators on the same project) needs an explicit ACL model.
app.get('/api/comments/:commentId', localAuth.requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params
    const userId = req.session.user.id
    const comment = db.getTaskComment(commentId)

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }
    if (String(comment.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden - not your comment' })
    }

    res.json(comment)
  } catch (error) {
    console.error('[Task Comments] Get comment error:', error)
    res.status(500).json({ error: 'Failed to get comment' })
  }
})

// BULLETPROOF AI COMMENT ENDPOINT - NEVER FAILS
app.post(
  '/api/tasks/:taskId/ai-comments-bulletproof',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { taskId } = req.params
      const { content, metadata = null } = req.body
      const userId = String(Math.floor(parseFloat(req.session.user.id)))

      console.log('[BULLETPROOF API] AI comment request:', {
        taskId,
        userId,
        hasContent: !!content
      })

      // Validate inputs
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' })
      }

      // Verify user has access to task
      const taskCheck = dbInstance
        .prepare('SELECT project_id FROM tasks WHERE id = ?')
        .get(taskId)
      if (!taskCheck) {
        return res.status(404).json({ error: 'Task not found' })
      }

      const project = db.getProject(taskCheck.project_id)
      if (!project || project.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // Use bulletproof function
      const result = db.createAIComment(
        taskId,
        userId,
        content.trim(),
        metadata
      )

      console.log(
        '[BULLETPROOF API] ✓ AI comment created successfully:',
        result.commentId
      )
      res.json({ id: result.commentId, success: true })
    } catch (error) {
      console.error('[BULLETPROOF API] Error:', error)
      res
        .status(500)
        .json({ error: 'Failed to add AI comment: ' + error.message })
    }
  }
)

// Per-user rate limit for the similarity detector (which is O(n^2) on the
// main event loop and previously had no auth-side throttling).
const detectSimilarLimiter = expressRateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute per IP+user combo
  keyGenerator: req => `${req.ip}:${req.session?.user?.id || 'anon'}`,
  message: { error: 'Too many similarity scans, please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false
})

// Task similarity detection and merging endpoints
app.post(
  '/api/tasks/detect-similar',
  localAuth.requireAuth,
  detectSimilarLimiter,
  async (req, res) => {
    try {
      const { projectId } = req.body
      const userId = req.session.user.id

      // Get project tasks
      const project = db.getProject(projectId)
      if (!project || project.user_id !== String(userId)) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const tasks = project.tasks || []
      if (tasks.length < 2) {
        return res.json({ groups: [] })
      }

      // Cap input size. detectSimilarTasks does O(n^2) regex/string work
      // on the main event loop; without a cap, a 1000-task project blocks
      // every other request for 100s of ms.
      const MAX_TASKS_FOR_SIMILARITY = 200
      if (tasks.length > MAX_TASKS_FOR_SIMILARITY) {
        return res.status(400).json({
          error: `Too many tasks for similarity scan (have ${tasks.length}, max ${MAX_TASKS_FOR_SIMILARITY}). Filter the project first.`
        })
      }

      // Detect similar task groups
      const similarGroups = await detectSimilarTasks(tasks)

      res.json({ groups: similarGroups })
    } catch (error) {
      console.error('[Task Similarity] Detection error:', error)
      res.status(500).json({ error: 'Failed to detect similar tasks' })
    }
  }
)

app.post('/api/tasks/merge', localAuth.requireAuth, async (req, res) => {
  try {
    const { projectId, taskIds } = req.body
    const userId = req.session.user.id

    // Get project
    const project = db.getProject(projectId)
    if (!project || project.user_id !== String(userId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const tasks = project.tasks || []
    const tasksToMerge = tasks.filter(task => taskIds.includes(task.id))

    if (tasksToMerge.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 tasks to merge' })
    }

    // Merge tasks using AI
    const mergedTask = await mergeTasksWithAI(userId, tasksToMerge)

    // Store merge metadata for undo functionality
    const mergeMetadata = {
      id: mergedTask.id,
      timestamp: new Date().toISOString(),
      originalTasks: tasksToMerge,
      mergedTask: { ...mergedTask }
    }

    // Update project with merged task
    const updatedTasks = tasks.filter(task => !taskIds.includes(task.id))
    updatedTasks.push(mergedTask)

    const updatedProject = { ...project, tasks: updatedTasks }
    db.saveProject(userId, updatedProject)

    // Store undo data in database for later retrieval
    db.storeMergeUndoData(userId, projectId, mergeMetadata)

    // Record merge activity
    db.recordTaskChange(
      mergedTask.id,
      String(userId),
      'tasks_merged',
      null,
      null,
      `Merged ${tasksToMerge.length} tasks: ${tasksToMerge.map(t => t.title).join(', ')}`,
      {
        source: 'task_merge',
        mergedTaskIds: taskIds,
        taskTitle: mergedTask.title,
        originalTasks: tasksToMerge.map(t => ({ id: t.id, title: t.title }))
      }
    )

    res.json({
      success: true,
      mergedTask,
      removedTaskIds: taskIds,
      mergeId: mergedTask.id // For undo reference
    })
  } catch (error) {
    console.error('[Task Merge] Error:', error)
    res.status(500).json({ error: 'Failed to merge tasks' })
  }
})

app.post('/api/tasks/undo-merge', localAuth.requireAuth, async (req, res) => {
  try {
    const { projectId, mergeId } = req.body
    const userId = req.session.user.id

    // Get project
    const project = db.getProject(projectId)
    if (!project || project.user_id !== String(userId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get merge undo data
    const mergeData = db.getMergeUndoData(String(userId), projectId, mergeId)
    if (!mergeData) {
      return res.status(404).json({ error: 'Merge data not found or expired' })
    }

    const { originalTasks, mergedTask } = JSON.parse(mergeData.metadata)

    // Record undo activity BEFORE removing the merged task
    db.recordTaskChange(
      mergeId,
      String(userId),
      'merge_undone',
      null,
      null,
      `Undid merge, restored ${originalTasks.length} original tasks`,
      {
        source: 'merge_undo',
        restoredTaskIds: originalTasks.map(t => t.id),
        taskTitle: mergedTask.title,
        restoredTasks: originalTasks.map(t => ({ id: t.id, title: t.title }))
      }
    )

    // Restore original tasks and remove merged task
    const tasks = project.tasks || []
    const updatedTasks = tasks.filter(task => task.id !== mergeId)
    updatedTasks.push(...originalTasks)

    const updatedProject = { ...project, tasks: updatedTasks }
    db.saveProject(userId, updatedProject)

    // Clean up undo data
    db.deleteMergeUndoData(String(userId), projectId, mergeId)

    res.json({
      success: true,
      restoredTasks: originalTasks,
      removedMergeId: mergeId
    })
  } catch (error) {
    console.error('[Task Undo] Error:', error)
    res.status(500).json({ error: 'Failed to undo merge' })
  }
})

// Get recent merges for undo functionality
app.get(
  '/api/tasks/recent-merges/:projectId',
  localAuth.requireAuth,
  async (req, res) => {
    try {
      const { projectId } = req.params
      const userId = req.session.user.id

      // Verify project access
      const project = db.getProject(projectId)
      if (!project || project.user_id !== String(userId)) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // Get recent merges that can still be undone
      const recentMerges = db.getRecentMerges(String(userId), projectId)

      // Prevent caching to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      })

      res.json({ merges: recentMerges })
    } catch (error) {
      console.error('[Recent Merges] Error:', error)
      res.status(500).json({ error: 'Failed to get recent merges' })
    }
  }
)

// Helper function to detect similar tasks
async function detectSimilarTasks(tasks) {
  const groups = []
  const processed = new Set()

  for (let i = 0; i < tasks.length; i++) {
    if (processed.has(i)) {
      continue
    }

    const task1 = tasks[i]
    const similarTasks = [{ task: task1, index: i }]

    for (let j = i + 1; j < tasks.length; j++) {
      if (processed.has(j)) {
        continue
      }

      const task2 = tasks[j]
      const similarity = calculateTaskSimilarity(task1, task2)

      if (similarity.score >= 0.7) {
        similarTasks.push({ task: task2, index: j })
        processed.add(j)
      }
    }

    if (similarTasks.length >= 2) {
      processed.add(i)
      groups.push({
        id: `group_${i}`,
        tasks: similarTasks.map(item => item.task),
        similarity: calculateGroupSimilarity(
          similarTasks.map(item => item.task)
        ),
        reason: getSimilarityReason(similarTasks.map(item => item.task))
      })
    }
  }

  return groups
}

// Calculate similarity between two tasks
function calculateTaskSimilarity(task1, task2) {
  let score = 0
  const reasons = []

  // Entity-based similarity (company names, project terms) - include comments
  const getTaskText = task => {
    let text = task.title + ' ' + (task.description || '')

    // Include comments in similarity analysis
    if (task.comments && Array.isArray(task.comments)) {
      const commentTexts = task.comments.map(c => c.content || '').join(' ')
      text += ' ' + commentTexts
    }

    return text
  }

  const entities1 = extractEntities(getTaskText(task1))
  const entities2 = extractEntities(getTaskText(task2))

  const commonEntities = entities1.filter(entity => entities2.includes(entity))
  if (commonEntities.length > 0) {
    score += 0.4
    reasons.push(`Shared entities: ${commonEntities.join(', ')}`)
  }

  // Keyword similarity - include comments
  const keywords1 = extractKeywords(getTaskText(task1))
  const keywords2 = extractKeywords(getTaskText(task2))

  const commonKeywords = keywords1.filter(kw => keywords2.includes(kw))
  const keywordSimilarity =
    commonKeywords.length / Math.max(keywords1.length, keywords2.length)

  if (keywordSimilarity >= 0.3) {
    score += keywordSimilarity * 0.4
    reasons.push(`Common keywords: ${commonKeywords.slice(0, 3).join(', ')}`)
  }

  // Same assignee
  if (task1.assignee && task2.assignee && task1.assignee === task2.assignee) {
    score += 0.2
    reasons.push(`Same assignee: ${task1.assignee}`)
  }

  // Sequential workflow detection
  if (isSequentialTasks(task1, task2)) {
    score += 0.3
    reasons.push('Sequential workflow detected')
  }

  return { score, reasons }
}

// Extract entities (company names, project names, document types)
function extractEntities(text) {
  const entities = []
  // Note: upperText variable removed as it was unused

  // Common company/project patterns
  const entityPatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:CONTRACT|AGREEMENT|RENEWAL|PROJECT|TASK)\b/gi,
    /\b(CERTINIA|SALESFORCE|MICROSOFT|ADOBE|GOOGLE|AMAZON)\b/gi,
    /\b([A-Z]{2,})\b/g // Acronyms
  ]

  entityPatterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      entities.push(...matches.map(m => m.trim().toLowerCase()))
    }
  })

  return [...new Set(entities)] // Remove duplicates
}

// Extract keywords
function extractKeywords(text) {
  const stopWords = [
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'among',
    'around',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between'
  ]

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .filter(word => isNaN(word)) // Remove numbers
}

// Detect sequential tasks
function isSequentialTasks(task1, task2) {
  const sequentialPatterns = [
    ['review', 'approve'],
    ['create', 'sign'],
    ['draft', 'finalize'],
    ['plan', 'execute'],
    ['design', 'implement'],
    ['research', 'write'],
    ['contract', 'agreement'],
    ['renewal', 'tpsa']
  ]

  const text1 = (task1.title + ' ' + (task1.description || '')).toLowerCase()
  const text2 = (task2.title + ' ' + (task2.description || '')).toLowerCase()

  return sequentialPatterns.some(
    ([first, second]) =>
      (text1.includes(first) && text2.includes(second)) ||
      (text1.includes(second) && text2.includes(first))
  )
}

// Calculate group similarity metrics
function calculateGroupSimilarity(tasks) {
  if (tasks.length < 2) {
    return { score: 0, confidence: 'low' }
  }

  let totalScore = 0
  let comparisons = 0

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      totalScore += calculateTaskSimilarity(tasks[i], tasks[j]).score
      comparisons++
    }
  }

  const avgScore = totalScore / comparisons
  let confidence = 'low'
  if (avgScore >= 0.8) {
    confidence = 'high'
  } else if (avgScore >= 0.7) {
    confidence = 'medium'
  }

  return { score: avgScore, confidence }
}

// Get human-readable similarity reason
function getSimilarityReason(tasks) {
  if (tasks.length < 2) {
    return 'Unknown'
  }

  // Check for common entities
  const allEntities = tasks.flatMap(task =>
    extractEntities(task.title + ' ' + (task.description || ''))
  )
  const entityCounts = allEntities.reduce((acc, entity) => {
    acc[entity] = (acc[entity] || 0) + 1
    return acc
  }, {})

  const commonEntities = Object.entries(entityCounts)
    .filter(([, count]) => count >= 2)
    .map(([entity]) => entity)

  if (commonEntities.length > 0) {
    return `Related to ${commonEntities[0]}`
  }

  // Check for workflow patterns
  const hasSequential = tasks.some((task1, i) =>
    tasks.slice(i + 1).some(task2 => isSequentialTasks(task1, task2))
  )

  if (hasSequential) {
    return 'Sequential workflow tasks'
  }

  return 'Similar content detected'
}

// AI-powered task merging
async function mergeTasksWithAI(userId, tasks) {
  try {
    const prompt = `You are merging multiple related tasks into a single, comprehensive task.

TASKS TO MERGE:
${tasks
  .map(
    (task, idx) => `
${idx + 1}. "${task.title}"
   Description: ${task.description || 'No description'}
   Status: ${task.status}
   Priority: ${task.priority}
   Assignee: ${task.assignee || 'Unassigned'}
   Due Date: ${task.dueDate || 'No due date'}
`
  )
  .join('')}

Please merge these tasks intelligently by:
1. Creating a comprehensive title that encompasses all tasks
2. Combining descriptions while removing redundancy
3. Choosing the highest priority level
4. Selecting the most appropriate status
5. Keeping the earliest due date if any
6. Preserving assignee information

Return ONLY a JSON object with this structure:
{
  "title": "Merged task title",
  "description": "Combined description with all relevant details",
  "status": "most appropriate status",
  "priority": "highest priority from merged tasks",
  "assignee": "assignee if consistent, or primary assignee",
  "dueDate": "earliest due date or null"
}`
    const completion = await aiProvider.createChatCompletion(userId, {
      messages: [
        {
          role: 'system',
          content:
            'You are a precise task-merging assistant. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    })

    const content = completion?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('AI merge response was empty')
    }
    const mergedTaskData = JSON.parse(content)

    // Create merged task with metadata
    const mergedTask = {
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...mergedTaskData,
      createdAt: new Date().toISOString(),
      mergedFrom: tasks.map(task => ({
        id: task.id,
        title: task.title
      })),
      subtasks: tasks.flatMap(task => task.subtasks || []),
      comments: []
    }

    return mergedTask
  } catch (error) {
    console.error('[Task Merge AI] Error:', error)

    // Fallback to simple merge if AI fails
    const mergedTask = {
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: tasks.map(t => t.title).join(' + '),
      description: tasks
        .map(t => `• ${t.title}${t.description ? `: ${t.description}` : ''}`)
        .join('\n'),
      status:
        tasks.find(t => t.status === 'in-progress')?.status || tasks[0].status,
      priority: tasks.reduce((highest, task) => {
        const priorities = { low: 1, medium: 2, high: 3 }
        return priorities[task.priority] > priorities[highest]
          ? task.priority
          : highest
      }, 'low'),
      assignee: tasks.find(t => t.assignee)?.assignee || '',
      dueDate:
        tasks
          .map(t => t.dueDate)
          .filter(Boolean)
          .sort()[0] || null,
      createdAt: new Date().toISOString(),
      mergedFrom: tasks.map(task => ({ id: task.id, title: task.title })),
      subtasks: tasks.flatMap(task => task.subtasks || []),
      comments: []
    }

    return mergedTask
  }
}

// Admin API endpoints for dashboard
// Middleware to check admin access
const requireAdmin = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    // Skip auth in development
    next()
    return
  }

  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

// Admin dashboard metrics
app.get('/api/admin/metrics/dashboard', requireAdmin, (req, res) => {
  try {
    // Get user count
    const userCount = dbInstance
      .prepare('SELECT COUNT(*) as count FROM users WHERE active = 1')
      .get()

    // Get project count (tenants equivalent)
    const projectCount = dbInstance
      .prepare('SELECT COUNT(DISTINCT user_id) as count FROM projects')
      .get()

    // Get task count and recent activity
    const taskCount = dbInstance
      .prepare('SELECT COUNT(*) as count FROM tasks')
      .get()
    const recentTasks = dbInstance
      .prepare(
        `
      SELECT COUNT(*) as count FROM tasks
      WHERE created_at > datetime('now', '-7 days')
    `
      )
      .get()

    // Get meeting count (activity metric)
    const meetingCount = dbInstance
      .prepare('SELECT COUNT(*) as count FROM meetings')
      .get()
    const recentMeetings = dbInstance
      .prepare(
        `
      SELECT COUNT(*) as count FROM meetings
      WHERE created_at > datetime('now', '-7 days')
    `
      )
      .get()

    // Drops the previous mocked fields (monthlyRevenue, revenueGrowth, etc.)
    // which were Math.random() or fictional. Returns only values we actually
    // compute from the DB.
    res.json({
      totalUsers: userCount.count,
      totalProjects: projectCount.count,
      totalTasks: taskCount.count,
      totalMeetings: meetingCount.count,
      tasksLast30Days: recentTasks.count,
      meetingsLast7Days: recentMeetings.count
    })
  } catch (error) {
    console.error('[Admin API] Dashboard metrics error:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' })
  }
})

// System health. Real values from process/os/db. Drops the previous
// Math.random() placeholders (responseTime, connections, cpu, memory).
app.get('/api/admin/system/health', requireAdmin, (req, res) => {
  try {
    const memUsage = process.memoryUsage()
    const dbStats = dbInstance
      .prepare(
        "SELECT COUNT(*) as tables FROM sqlite_master WHERE type='table'"
      )
      .get()
    const taskCount = dbInstance
      .prepare('SELECT COUNT(*) as count FROM tasks')
      .get()

    let dbStatus = 'healthy'
    try {
      dbInstance.prepare('SELECT 1').get()
    } catch (_e) {
      dbStatus = 'unhealthy'
    }

    res.json({
      api: { status: 'healthy', uptimeSeconds: Math.floor(process.uptime()) },
      database: {
        status: dbStatus,
        tables: dbStats.tables,
        totalTasks: taskCount.count
      },
      memory: {
        rssBytes: memUsage.rss,
        heapUsedBytes: memUsage.heapUsed,
        heapTotalBytes: memUsage.heapTotal
      },
      node: {
        version: process.version,
        platform: process.platform
      }
    })
  } catch (error) {
    console.error('[Admin API] System health error:', error)
    res.status(500).json({ error: 'Failed to fetch system health' })
  }
})

// Get users for admin management
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    const users = dbInstance
      .prepare(
        `
      SELECT id, email, name, role, active, auth_provider, created_at, last_login
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset)

    const totalUsers = dbInstance
      .prepare('SELECT COUNT(*) as count FROM users')
      .get()

    res.json({
      users,
      pagination: {
        page,
        limit,
        total: totalUsers.count,
        pages: Math.ceil(totalUsers.count / limit)
      }
    })
  } catch (error) {
    console.error('[Admin API] Users list error:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// Get projects (tenants) for admin management
app.get('/api/admin/tenants', requireAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    const projects = dbInstance
      .prepare(
        `
      SELECT
        p.id, p.name, p.user_id, p.created_at,
        u.email as owner_email,
        COUNT(t.id) as task_count
      FROM projects p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset)

    const totalProjects = dbInstance
      .prepare('SELECT COUNT(*) as count FROM projects')
      .get()

    res.json({
      tenants: projects.map(p => ({
        id: p.id,
        name: p.name,
        subdomain: p.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        owner: p.owner_email,
        taskCount: p.task_count,
        status: 'active',
        createdAt: p.created_at
      })),
      pagination: {
        page,
        limit,
        total: totalProjects.count,
        pages: Math.ceil(totalProjects.count / limit)
      }
    })
  } catch (error) {
    console.error('[Admin API] Tenants list error:', error)
    res.status(500).json({ error: 'Failed to fetch tenants' })
  }
})

// Get analytics data
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  try {
    const timeframe = req.query.timeframe || '30d'

    // Task creation over time
    const tasksByDate = dbInstance
      .prepare(
        `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM tasks
      WHERE created_at > datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `
      )
      .all()

    // User registration over time
    const usersByDate = dbInstance
      .prepare(
        `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at > datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `
      )
      .all()

    res.json({
      taskCreation: tasksByDate,
      userRegistration: usersByDate,
      timeframe
    })
  } catch (error) {
    console.error('[Admin API] Analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API running on http://0.0.0.0:${PORT}`)
  console.log('[Server] Using SQLite database')
})
