import { Issuer, generators } from 'openid-client'
import * as db from './database.js'

// Module-level singletons. The Issuer/Client are immutable once discovered;
// openid-client refreshes JWKS internally as needed. Caching the discovery
// Promise (not the resolved value) means concurrent first-callers all await
// the same in-flight discovery instead of racing.
let _issuerPromise = null
let _clientPromise = null

// Set to true the first time we successfully process a callback so we can
// dump the raw userinfo claims at INFO level once per process lifetime
// (helps verify what Zitadel actually emits without flooding logs forever).
let _hasLoggedFirstUserinfo = false

function readConfigFromEnv() {
  const issuer = process.env.ZITADEL_ISSUER
  const clientId = process.env.ZITADEL_CLIENT_ID
  const callbackUrl = process.env.OIDC_CALLBACK_URL
  return { issuer, clientId, callbackUrl }
}

export function isOIDCEnabled() {
  const { issuer, clientId, callbackUrl } = readConfigFromEnv()
  return Boolean(issuer && clientId && callbackUrl)
}

async function getIssuer() {
  if (_issuerPromise) {
    return _issuerPromise
  }
  const { issuer } = readConfigFromEnv()
  if (!issuer) {
    throw new Error('ZITADEL_ISSUER is not configured')
  }
  console.log('[OIDC] Discovering issuer:', issuer)
  _issuerPromise = Issuer.discover(issuer).then(disc => {
    console.log('[OIDC] Issuer discovered:', disc.metadata.issuer)
    return disc
  })
  return _issuerPromise
}

async function getClient() {
  if (_clientPromise) {
    return _clientPromise
  }
  _clientPromise = (async () => {
    const issuer = await getIssuer()
    const { clientId, callbackUrl } = readConfigFromEnv()
    const client = new issuer.Client({
      client_id: clientId,
      redirect_uris: [callbackUrl],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    })
    console.log('[OIDC] Public PKCE client initialized for', clientId)
    return client
  })().catch(err => {
    // On failure, clear the cache so subsequent calls retry instead of
    // returning a permanently-failing promise.
    _clientPromise = null
    _issuerPromise = null
    throw err
  })
  return _clientPromise
}

// Generate a Zitadel authorization URL.
//
// `intent` is an optional caller-supplied hint for which Zitadel hosted
// screen the user should land on:
//   - 'register' -> add `prompt=create` so first-time visitors from the
//     marketing site's "Get started" CTA see the registration screen
//     directly instead of the login screen.
//   - anything else (or unset) -> standard login screen.
//
// `prompt=create` is the Zitadel convention; the OIDC `prompt` parameter
// itself is standard, the value is the IdP-specific extension. If we ever
// swap to a non-Zitadel IdP, this is the single line to revisit.
export async function getAuthorizationUrl({ intent } = {}) {
  const client = await getClient()
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)
  const state = generators.state()
  const nonce = generators.nonce()

  const authParams = {
    scope: 'openid email profile offline_access',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce
  }

  if (intent === 'register') {
    authParams.prompt = 'create'
  }

  const authUrl = client.authorizationUrl(authParams)

  return { authUrl, codeVerifier, state, nonce }
}

export async function handleCallback(
  callbackUrl,
  storedCodeVerifier,
  storedState,
  storedNonce
) {
  const client = await getClient()
  const params = client.callbackParams(callbackUrl)
  const tokenSet = await client.callback(
    client.metadata.redirect_uris[0],
    params,
    {
      code_verifier: storedCodeVerifier,
      state: storedState,
      nonce: storedNonce
    }
  )

  const userinfo = await client.userinfo(tokenSet.access_token)

  if (!_hasLoggedFirstUserinfo) {
    _hasLoggedFirstUserinfo = true
    console.log(
      '[OIDC] First-userinfo dump (process lifetime):',
      JSON.stringify(userinfo, null, 2)
    )
  }

  return { tokenSet, userinfo }
}

export async function refreshTokenSet(refreshToken) {
  const client = await getClient()
  return client.refresh(refreshToken)
}

export async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) {
    return
  }
  try {
    const client = await getClient()
    await client.revoke(refreshToken, 'refresh_token')
    console.log('[OIDC] Refresh token revoked')
  } catch (err) {
    // Best-effort. If revocation fails, the local session is still destroyed
    // by the caller; the refresh token will simply expire on Zitadel's side.
    console.warn('[OIDC] revoke failed (best-effort):', err.message)
  }
}

export async function getEndSessionUrl({
  idTokenHint,
  postLogoutRedirectUri,
  state
}) {
  const client = await getClient()
  return client.endSessionUrl({
    id_token_hint: idTokenHint,
    post_logout_redirect_uri: postLogoutRedirectUri,
    state
  })
}

// Resolve which tenant a Zitadel-authenticated user should belong to.
//
// Strategies:
//   - 'zitadel_org' (env TENANT_STRATEGY=zitadel_org)
//       Read the urn:kainban:org:id custom claim emitted by the Zitadel
//       Action `addOrgClaims`. Look up an existing tenant by zitadel_org_id;
//       auto-create one with the org name if missing. Falls through to the
//       default tenant if the claim isn't present (e.g. Action not yet
//       configured, or running in a non-prod env without it).
//
//   - 'default' (any other value, including unset)
//       Single-tenant mode. All users go into the 'kainban' default tenant.
//       This is the safe default and matches the initial Zitadel cutover.
function resolveTenantForUserinfo(userinfo) {
  const strategy = process.env.TENANT_STRATEGY || 'default'
  if (strategy === 'zitadel_org') {
    const orgId = userinfo['urn:kainban:org:id']
    const orgName = userinfo['urn:kainban:org:name']
    if (orgId) {
      try {
        return db.getOrCreateTenantForZitadelOrg(orgId, orgName)
      } catch (err) {
        console.warn(
          '[OIDC] Zitadel org tenant lookup failed (falling back to default):',
          err.message
        )
      }
    } else {
      console.warn(
        '[OIDC] TENANT_STRATEGY=zitadel_org but urn:kainban:org:id claim missing - check the Zitadel Action is bound to Pre Userinfo creation. Falling back to default tenant.'
      )
    }
  }
  return db.getOrCreateDefaultTenant()
}

function parseBootstrapAdminEmails() {
  const raw = process.env.ZITADEL_BOOTSTRAP_ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

// Determines the role for a brand-new OIDC user. Bootstrap-admin only fires
// when there are zero active admins in the DB AND the user's email is in
// ZITADEL_BOOTSTRAP_ADMIN_EMAILS. Once an admin exists, the env var is inert.
function determineRoleForNewUser(email) {
  const adminCount = db.getActiveAdminCount()
  if (adminCount > 0) {
    return 'member'
  }
  const bootstrapEmails = parseBootstrapAdminEmails()
  if (email && bootstrapEmails.includes(email.toLowerCase())) {
    console.log(
      '[OIDC] Bootstrap-admin promoting',
      email,
      '(no existing admins, email in ZITADEL_BOOTSTRAP_ADMIN_EMAILS)'
    )
    return 'admin'
  }
  // No admin yet, no env match: still grant admin to the very first user
  // so the install is recoverable. Matches existing localAuth behavior.
  if (!db.hasUsers()) {
    console.log('[OIDC] First user becomes admin by default:', email)
    return 'admin'
  }
  return 'member'
}

// Find or upsert a user from a Zitadel userinfo payload.
//
// Lookup order:
//   1. By (oidc_issuer, oidc_sub) - the canonical key. Refresh email/name.
//   2. By email if userinfo.email_verified AND existing row was local-auth
//      AND existing row.email_verified - link by attaching oidc_sub/issuer.
//   3. Create new user with default tenant.
export function findOrCreateOIDCUser(userinfo, issuer) {
  const sub = userinfo.sub
  const claimedEmail = userinfo.email || null
  const claimedEmailVerified = Boolean(userinfo.email_verified)

  let user = db.getUserByOIDC(issuer, sub)

  if (user) {
    // Refresh mutable profile fields if they've changed in Zitadel.
    const updates = {}
    if (claimedEmail && claimedEmail !== user.email) {
      updates.email = claimedEmail
      updates.email_verified = claimedEmailVerified ? 1 : 0
    } else if (claimedEmailVerified && !user.email_verified) {
      updates.email_verified = 1
    }
    if (userinfo.name && userinfo.name !== user.name) {
      updates.name = userinfo.name
    }
    if (userinfo.picture && userinfo.picture !== user.picture) {
      updates.picture = userinfo.picture
    }
    if (Object.keys(updates).length > 0) {
      user = db.updateUser(user.id, updates)
      console.log(
        '[OIDC] Refreshed user fields:',
        user.email,
        Object.keys(updates)
      )
    }
    db.updateUserLogin(user.id)
    return user
  }

  // We need the resolved tenant first - the email-linking path below must
  // be scoped to it to prevent cross-tenant account takeover. Concretely:
  // if alice@acme.com exists in tenant X (verified) and a Zitadel-side
  // account with the same email is created in tenant Y, linking by email
  // alone would silently move alice from X to Y. Both sides must agree on
  // tenant before linking.
  const tenant = resolveTenantForUserinfo(userinfo)

  // Account-linking by verified email. Both sides must be verified AND
  // share the same tenant to prevent cross-tenant account takeover.
  //
  // We accept linking from local-auth rows AND from previous-OIDC-provider
  // rows (e.g. PocketID -> Zitadel migration). The Zitadel-side
  // email_verified=true gate is the security boundary; the tenant_id check
  // below is the multi-tenancy guardrail.
  if (claimedEmail && claimedEmailVerified) {
    const existing = db.getUserByEmail(claimedEmail)
    if (existing && existing.email_verified === 1) {
      // Tenant gate: only link if the existing row is in the same tenant
      // we resolved for this login. Skip the link otherwise (will fall
      // through to user creation, which may then collide with the table-
      // level UNIQUE on users.email - that's a pre-existing schema issue
      // tracked separately, but a 500 from a UNIQUE failure is far better
      // than a silent cross-tenant account takeover).
      if (existing.tenant_id && tenant.id && existing.tenant_id !== tenant.id) {
        console.warn(
          '[OIDC] Refusing email-link across tenants:',
          existing.email,
          'existing tenant=',
          existing.tenant_id,
          'resolved tenant=',
          tenant.id
        )
      } else {
        const reason =
          existing.auth_provider === 'local'
            ? 'local-auth row'
            : `prior OIDC issuer ${existing.oidc_issuer || 'unknown'}`
        console.log(
          '[OIDC] Linking Zitadel sub to existing user:',
          existing.email,
          '(was',
          reason + ')'
        )
        user = db.updateUser(existing.id, {
          oidc_issuer: issuer,
          oidc_sub: sub,
          auth_provider: 'oidc',
          email_verified: 1,
          name: userinfo.name || existing.name,
          picture: userinfo.picture || existing.picture
        })
        db.updateUserLogin(user.id)
        return user
      }
    }
  }

  // Create new user. Tenant resolution honors TENANT_STRATEGY env var:
  //   - zitadel_org: map from urn:kainban:org:id custom claim
  //   - default (or unset): single 'kainban' tenant for everyone
  const role = determineRoleForNewUser(claimedEmail)

  user = db.createUser({
    email: claimedEmail,
    email_verified: claimedEmailVerified ? 1 : 0,
    name: userinfo.name || (claimedEmail ? claimedEmail.split('@')[0] : 'User'),
    picture: userinfo.picture || null,
    role,
    auth_provider: 'oidc',
    oidc_issuer: issuer,
    oidc_sub: sub,
    tenant_id: tenant.id
  })
  console.log(
    '[OIDC] Created new user:',
    user.email,
    'role=',
    user.role,
    'tenant=',
    tenant.subdomain
  )
  db.updateUserLogin(user.id)
  return user
}

export function formatUserForSession(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: user.auth_provider,
    email_verified: !!user.email_verified
  }
}

export default {
  isOIDCEnabled,
  getAuthorizationUrl,
  handleCallback,
  refreshTokenSet,
  revokeRefreshToken,
  getEndSessionUrl,
  findOrCreateOIDCUser,
  formatUserForSession
}
