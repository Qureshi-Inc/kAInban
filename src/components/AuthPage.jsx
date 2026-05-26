import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

/**
 * Sign-in entry point.
 *
 * Default flow: single "Sign in" button -> /api/auth/oidc/login -> Zitadel
 * hosted UI handles login + signup + email verification + reset, then redirects
 * back to /api/auth/oidc/callback which sets the session and lands on APP_URL.
 *
 * Rollback flow: ?local=1 in the URL re-mounts the legacy LoginForm. The
 * backend's LOCAL_LOGIN_FALLBACK env flag controls whether the underlying
 * /api/auth/login route actually accepts requests; if false, the form will
 * receive 410 errors. UI fallback is intentionally always available so a
 * visual rollback is one URL away.
 */
// Map raw OIDC errors (often opaque strings from openid-client or Zitadel)
// to user-friendly messages. Anything we don't recognize falls through with
// a generic prefix so the raw text is still available for support but doesn't
// dominate the UI.
function friendlyOidcError(raw) {
  if (!raw) {return ''}
  const s = String(raw).toLowerCase()
  if (s.includes('invalid_grant') || s.includes('expired')) {
    return 'Your sign-in link expired. Please try signing in again.'
  }
  if (s.includes('access_denied') || s.includes('user cancelled')) {
    return 'Sign-in was cancelled.'
  }
  if (s.includes('state argument') || s.includes('invalid oidc session')) {
    return 'Sign-in session expired. Please try again.'
  }
  if (s.includes('nonce')) {
    return 'Sign-in verification failed. Please try again.'
  }
  if (s.includes('not enabled') || s.includes('not configured')) {
    return 'Sign-in is temporarily unavailable. Please contact support.'
  }
  return `Sign-in failed: ${raw}`
}

export default function AuthPage({ onAuthSuccess }) {
  const [oidcError, setOidcError] = useState('')
  const [showLocal, setShowLocal] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oidcErr = params.get('oidc_error')
    if (oidcErr) {
      setOidcError(friendlyOidcError(oidcErr))
    }
    if (params.get('local') === '1') {
      setShowLocal(true)
    }

    // Strip oidc_success / oidc_error from URL after consuming them so they
    // don't persist on reload.
    if (params.has('oidc_success') || params.has('oidc_error')) {
      params.delete('oidc_success')
      params.delete('oidc_error')
      const cleaned = window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash
      window.history.replaceState({}, '', cleaned)
    }
  }, [])

  // Local-fallback handlers - only reachable via ?local=1
  const handleLogin = async(email, password) => {
    setError('')
    try {
      const apiService = (await import('../services/apiService')).default
      const response = await apiService.login(email, password)
      if (response.success) {
        if (response.redirectUrl) {
          window.location.href = response.redirectUrl
          return
        }
        onAuthSuccess(response.user)
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    }
  }

  const handleRegister = async(name, email, password, tenantData = null, recaptchaToken = null) => {
    setError('')
    try {
      const apiService = (await import('../services/apiService')).default
      const response = await apiService.register(name, email, password, tenantData, recaptchaToken)
      if (response.success) {
        if (response.tenant && response.tenant.subdomain) {
          const currentHost = window.location.hostname
          const tenantUrl = `${window.location.protocol}//${response.tenant.subdomain}.${currentHost}${window.location.port ? ':' + window.location.port : ''}`
          setTimeout(() => {
            window.location.href = tenantUrl
          }, 1000)
        } else {
          onAuthSuccess(response.user)
        }
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    }
  }

  if (showLocal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-3 text-xs text-warning text-center">
            Local-auth fallback mode (rollback). Remove <code>?local=1</code> for normal sign-in.
          </div>
          <LoginForm
            onLogin={handleLogin}
            onSwitchToRegister={() => setShowLocal('register')}
            error={error}
          />
        </div>
      </div>
    )
  }

  if (showLocal === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-3 text-xs text-warning text-center">
            Local-auth fallback mode.
          </div>
          <RegisterForm
            onRegister={handleRegister}
            onSwitchToLogin={() => setShowLocal(true)}
            error={error}
            isFirstUser={false}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md mx-auto p-8 bg-card rounded-md shadow-lg border border-border"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto flex items-center justify-center mb-4">
            <img src="/icon-192.png" alt="kAInban" className="w-14 h-14 object-contain" />
          </div>
          <h2 className="font-serif-display text-4xl text-foreground">
            kAInban
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">Sign in to continue</p>
        </div>

        {oidcError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm text-destructive text-sm"
          >
            {oidcError}
          </motion.div>
        )}

        <a
          href="/api/auth/oidc/login"
          className="block w-full text-center px-4 py-3 rounded-lg font-medium text-white bg-primary hover:bg-primary/90 transition-colors shadow-md"
        >
          Sign in
        </a>

        <p className="mt-4 text-xs text-center text-muted-foreground">
          Secure sign-in powered by Zitadel
        </p>
      </motion.div>
    </div>
  )
}
