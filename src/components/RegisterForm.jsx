import { motion } from 'framer-motion'
import { Mail, Lock, User, Loader2, Check, X, KeyRound } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import apiService from '../services/apiService'
import { Button } from './ui/button'
import { Input } from './ui/input'

export default function RegisterForm({ onRegister, onSwitchToLogin, error, isFirstUser }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oidcLoading, setOidcLoading] = useState(false)
  const [oidcEnabled, setOidcEnabled] = useState(false)

  useEffect(() => {
    // Check if OIDC is enabled
    apiService.getOIDCStatus().then(status => {
      setOidcEnabled(status.enabled)
    })
  }, [])

  const passwordValidation = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    match: password === confirmPassword && password.length > 0
  }

  const isValid =
    name.trim().length >= 2 &&
    email.includes('@') &&
    passwordValidation.minLength &&
    passwordValidation.hasUpper &&
    passwordValidation.hasLower &&
    passwordValidation.hasNumber &&
    passwordValidation.match

  const handleSubmit = async(e) => {
    e.preventDefault()
    if (!isValid) {return}

    setLoading(true)
    try {
      await onRegister(name, email, password)
    } finally {
      setLoading(false)
    }
  }

  const handleOIDCLogin = async() => {
    setOidcLoading(true)
    try {
      const authUrl = await apiService.initiateOIDCLogin()
      // Redirect to OIDC provider
      window.location.href = authUrl
    } catch (error) {
      console.error('[RegisterForm] OIDC login error:', error)
      setOidcLoading(false)
    }
  }

  const ValidationItem = ({ valid, text }) => (
    <div className="flex items-center gap-2 text-xs">
      {valid ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <X className="h-3 w-3 text-gray-400" />
      )}
      <span className={valid ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
        {text}
      </span>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md mx-auto p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-gray-700"
    >
      <div className="text-center mb-8">
        <motion.div
          className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-3xl shadow-lg ring-2 ring-primary/20 mb-4"
          whileHover={{ scale: 1.1, rotate: 10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        >
          🎤
        </motion.div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {isFirstUser ? 'Create Admin Account' : 'Create Account'}
        </h2>
        <p className="text-muted-foreground mt-2">
          {isFirstUser ? 'Set up your admin account to get started' : 'Sign up to get started'}
        </p>
      </div>

      {isFirstUser && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 text-sm"
        >
          This will be the first admin account. You'll have full access to manage users and settings.
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10"
              required
              disabled={loading}
              minLength={2}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
              disabled={loading}
            />
          </div>
          {password && (
            <div className="mt-2 space-y-1 p-2 bg-gray-50 dark:bg-gray-900 rounded">
              <ValidationItem valid={passwordValidation.minLength} text="At least 8 characters" />
              <ValidationItem valid={passwordValidation.hasUpper} text="One uppercase letter" />
              <ValidationItem valid={passwordValidation.hasLower} text="One lowercase letter" />
              <ValidationItem valid={passwordValidation.hasNumber} text="One number" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10"
              required
              disabled={loading}
            />
          </div>
          {confirmPassword && (
            <div className="mt-2">
              <ValidationItem valid={passwordValidation.match} text="Passwords match" />
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || oidcLoading || !isValid}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            isFirstUser ? 'Create Admin Account' : 'Create Account'
          )}
        </Button>
      </form>

      {!isFirstUser && oidcEnabled && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleOIDCLogin}
            disabled={loading || oidcLoading}
          >
            {oidcLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting to PocketID...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Sign up with PocketID
              </>
            )}
          </Button>
        </>
      )}

      {!isFirstUser && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-primary hover:underline font-medium"
              disabled={loading}
            >
              Sign in
            </button>
          </p>
        </div>
      )}
    </motion.div>
  )
}
