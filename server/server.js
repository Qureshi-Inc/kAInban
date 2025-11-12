import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import session from 'express-session'
import connectSqlite3 from 'connect-sqlite3'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import path from 'path'
import * as db from './database.js'
import * as localAuth from './localAuth.js'
import * as oidcAuth from './oidcAuth.js'

const app = express()
const PORT = process.env.PORT || 3001
const STORAGE_DIR = process.env.STORAGE_DIR || './storage'
const MEETINGS_DIR = path.join(STORAGE_DIR, 'meetings')
const SQLiteStore = connectSqlite3(session)

// Trust proxy (nginx reverse proxy)
app.set('trust proxy', 1)

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8064',
    'https://localhost:8064',
    'http://notes.rodeomasjid.org:8064',
    'http://notes.rodeomasjid.org',
    'https://notes.rodeomasjid.org',
    /^http:\/\/192\.168\.\d+\.\d+:8064$/,  // Allow local IP addresses
    /^http:\/\/10\.\d+\.\d+\.\d+:8064$/    // Allow private network IPs
  ],
  credentials: true
}))
app.use(express.json({ limit: '100mb' }))  // Increased from 50mb to 100mb
app.use(express.urlencoded({ limit: '100mb', extended: true }))  // Added for form data
app.use(morgan('dev'))

// Session middleware
app.use(session({
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
}))

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
})

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
    const allowRegistration = process.env.ALLOW_REGISTRATION === 'true' || process.env.ALLOW_REGISTRATION === '1'

    // Allow registration if it's the first user (admin setup) or if registration is enabled
    if (!isFirstUser && !allowRegistration) {
      return res.status(403).json({ error: 'Registration is currently disabled' })
    }

    // Register user
    const user = await localAuth.registerUser({ email, password, name })

    // Create session
    req.session.user = localAuth.formatUserForSession(user)

    // Explicitly save session
    req.session.save((err) => {
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
    req.session.save((err) => {
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
  req.session.destroy((err) => {
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
  console.log('[Auth] /me called - Session user:', req.session?.user?.email || 'none')
  console.log('[Auth] /me called - Cookie header:', req.headers.cookie ? 'present' : 'missing')

  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: req.session.user })
})

app.get('/api/auth/status', (req, res) => {
  const allowRegistration = process.env.ALLOW_REGISTRATION === 'true' || process.env.ALLOW_REGISTRATION === '1'
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
    const { authUrl, codeVerifier, state } = oidcAuth.getAuthorizationUrl(settings)

    // Store code verifier and state in session
    req.session.oidcCodeVerifier = codeVerifier
    req.session.oidcState = state

    req.session.save((err) => {
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
    const { userinfo } = await oidcAuth.handleCallback(callbackUrl, codeVerifier, state)

    // Find or create user
    const user = oidcAuth.findOrCreateOIDCUser(userinfo, settings.oidc_issuer)

    // Create session
    req.session.user = oidcAuth.formatUserForSession(user)
    delete req.session.oidcCodeVerifier
    delete req.session.oidcState

    req.session.save((err) => {
      if (err) {
        console.error('[OIDC] Session save error:', err)
        return res.status(500).json({ error: 'Failed to create session' })
      }

      console.log('[OIDC] User logged in:', user.email)

      // Redirect to frontend with success
      const frontendUrl = process.env.APP_URL || 'https://notes.rodeomasjid.org'
      res.redirect(`${frontendUrl}?oidc_success=true`)
    })
  } catch (error) {
    console.error('[OIDC] Callback error:', error)
    const frontendUrl = process.env.APP_URL || 'https://notes.rodeomasjid.org'
    res.redirect(`${frontendUrl}?oidc_error=${encodeURIComponent(error.message)}`)
  }
})

// Settings endpoints
app.get('/api/settings', localAuth.requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    const settings = db.getSettings(userId)

    // If no settings in database, return environment variables
    if (!settings || !settings.azure_endpoint) {
      console.log('[Settings] No database settings, loading from environment variables')
      const enableOidc = process.env.ENABLE_OIDC === 'true' || process.env.ENABLE_OIDC === '1'
      console.log('[Settings] ENABLE_OIDC env:', process.env.ENABLE_OIDC, '-> enabled:', enableOidc)
      console.log('[Settings] POCKET_ID_CLIENT_ID env:', process.env.POCKET_ID_CLIENT_ID)
      return res.json({
        azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
        whisperDeployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper',
        gptDeployment: process.env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4',
        oidcEnabled: enableOidc,
        oidcClientId: process.env.POCKET_ID_CLIENT_ID || '',
        oidcClientSecret: process.env.POCKET_ID_CLIENT_SECRET || '',
        oidcIssuer: process.env.POCKET_ID_ISSUER || 'https://pocketid.app',
        oidcCallbackUrl: ''
      })
    }

    // Return database settings with environment variable fallbacks
    console.log('[Settings] Database settings found, oidc_enabled:', settings.oidc_enabled)
    res.json({
      azureEndpoint: settings.azure_endpoint || '',
      apiKey: settings.api_key || '',
      apiVersion: settings.api_version || '2024-02-01',
      whisperDeployment: settings.whisper_deployment || 'whisper-1',
      gptDeployment: settings.gpt_deployment || 'gpt-4',
      oidcEnabled: settings.oidc_enabled === 1,
      oidcClientId: settings.oidc_client_id || process.env.POCKET_ID_CLIENT_ID || '',
      oidcClientSecret: settings.oidc_client_secret || process.env.POCKET_ID_CLIENT_SECRET || '',
      oidcIssuer: settings.oidc_issuer || process.env.POCKET_ID_ISSUER || 'https://pocketid.app',
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
    console.log('  req.session.user.id:', req.session.user.id, typeof req.session.user.id)
    console.log('  Strict match (===):', project.user_id === req.session.user.id)
    console.log('  Loose match (==):', project.user_id == req.session.user.id)

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
    console.log('[Projects] Deleted:', req.params.id)
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
      console.log('[Meetings] Created meetings directory:', MEETINGS_DIR)
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
      console.log('[Meetings] Deleted summary file:', meeting.summary_file)
    }

    if (meeting.transcript_file && fs.existsSync(meeting.transcript_file)) {
      fs.unlinkSync(meeting.transcript_file)
      console.log('[Meetings] Deleted transcript file:', meeting.transcript_file)
    }

    // Delete from database
    db.deleteMeeting(id)
    console.log('[Meetings] Deleted meeting from database:', id)

    res.json({ success: true })
  } catch (error) {
    console.error('[Meetings] Delete error:', error)
    res.status(500).json({ error: 'Failed to delete meeting files' })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API running on http://0.0.0.0:${PORT}`)
  console.log('[Server] Using SQLite database')
})
