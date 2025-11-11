import { Issuer, generators } from 'openid-client'
import * as db from './database.js'

let oidcClient = null
let codeVerifier = null

/**
 * Initialize OIDC client with settings from database
 */
export async function initializeOIDC(settings) {
  if (!settings.oidcEnabled) {
    console.log('[OIDC] OIDC is disabled in settings')
    return null
  }

  if (!settings.oidcClientId || !settings.oidcClientSecret || !settings.oidcIssuer || !settings.oidcCallbackUrl) {
    console.log('[OIDC] Missing required OIDC configuration')
    return null
  }

  try {
    console.log('[OIDC] Discovering issuer:', settings.oidcIssuer)
    const issuer = await Issuer.discover(settings.oidcIssuer)

    console.log('[OIDC] Issuer discovered:', issuer.metadata.issuer)

    oidcClient = new issuer.Client({
      client_id: settings.oidcClientId,
      client_secret: settings.oidcClientSecret,
      redirect_uris: [settings.oidcCallbackUrl],
      response_types: ['code']
    })

    console.log('[OIDC] Client initialized successfully')
    return oidcClient
  } catch (error) {
    console.error('[OIDC] Failed to initialize:', error)
    return null
  }
}

/**
 * Get the authorization URL for OIDC login
 */
export function getAuthorizationUrl(settings) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized')
  }

  codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)
  const state = generators.state()

  const authUrl = oidcClient.authorizationUrl({
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state
  })

  return { authUrl, codeVerifier, state }
}

/**
 * Handle OIDC callback and exchange code for tokens
 */
export async function handleCallback(callbackUrl, storedCodeVerifier, storedState) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized')
  }

  try {
    const params = oidcClient.callbackParams(callbackUrl)
    const tokenSet = await oidcClient.callback(
      oidcClient.redirect_uris[0],
      params,
      {
        code_verifier: storedCodeVerifier,
        state: storedState
      }
    )

    const userinfo = await oidcClient.userinfo(tokenSet.access_token)

    return {
      tokenSet,
      userinfo
    }
  } catch (error) {
    console.error('[OIDC] Callback error:', error)
    throw error
  }
}

/**
 * Find or create user from OIDC userinfo
 */
export function findOrCreateOIDCUser(userinfo, issuer) {
  const sub = userinfo.sub

  // Try to find existing user by OIDC credentials
  let user = db.getUserByOIDC(issuer, sub)

  if (!user && userinfo.email) {
    // Try to find by email (for account linking)
    user = db.getUserByEmail(userinfo.email)

    if (user) {
      // Link OIDC to existing account
      console.log('[OIDC] Linking OIDC to existing user:', user.email)
      user = db.updateUser(user.id, {
        oidc_issuer: issuer,
        oidc_sub: sub,
        auth_provider: 'oidc',
        email_verified: userinfo.email_verified ? 1 : 0,
        name: userinfo.name || user.name,
        picture: userinfo.picture || user.picture
      })
    }
  }

  if (!user) {
    // Check group membership from OIDC userinfo
    const groups = userinfo.groups || []
    console.log('[OIDC] User groups:', groups)

    // Only allow users in 'admin' or 'user' groups
    const hasAccess = groups.includes('admin') || groups.includes('user')
    if (!hasAccess && db.hasUsers()) {
      throw new Error('Access denied: User must be in admin or user group')
    }

    // Create new user
    console.log('[OIDC] Creating new user from OIDC:', userinfo.email)

    // First user becomes admin, or users in 'admin' group
    const isFirstUser = !db.hasUsers()
    const isAdminGroup = groups.includes('admin')

    user = db.createUser({
      email: userinfo.email,
      email_verified: userinfo.email_verified || false,
      name: userinfo.name || userinfo.email?.split('@')[0],
      picture: userinfo.picture,
      role: isFirstUser || isAdminGroup ? 'admin' : 'member',
      auth_provider: 'oidc',
      oidc_issuer: issuer,
      oidc_sub: sub
    })
  } else if (user.auth_provider === 'oidc') {
    // Update role based on current group membership for existing OIDC users
    const groups = userinfo.groups || []
    const isAdminGroup = groups.includes('admin')
    const currentRole = user.role

    // Update role if it has changed based on group membership
    if (isAdminGroup && currentRole !== 'admin') {
      console.log('[OIDC] Promoting user to admin based on group membership:', user.email)
      user = db.updateUser(user.id, { role: 'admin' })
    } else if (!isAdminGroup && currentRole === 'admin' && user.id !== 1) {
      // Demote from admin if they're no longer in admin group (but never demote user ID 1)
      console.log('[OIDC] Demoting user from admin based on group membership:', user.email)
      user = db.updateUser(user.id, { role: 'member' })
    }
  }

  // Update last login
  db.updateUserLogin(user.id)

  return user
}

/**
 * Format user object for session storage
 */
export function formatUserForSession(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: user.auth_provider
  }
}

/**
 * Check if OIDC is enabled and configured
 */
export function isOIDCEnabled(settings) {
  return !!(
    settings &&
    settings.oidc_enabled &&
    settings.oidc_client_id &&
    settings.oidc_client_secret &&
    settings.oidc_issuer &&
    settings.oidc_callback_url
  )
}

export default {
  initializeOIDC,
  getAuthorizationUrl,
  handleCallback,
  findOrCreateOIDCUser,
  formatUserForSession,
  isOIDCEnabled
}
