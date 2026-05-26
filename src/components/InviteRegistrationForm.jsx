import { motion } from 'framer-motion'
import { UserPlus, Mail, Lock, User, Building, AlertCircle, CheckCircle } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'

export default function InviteRegistrationForm() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [inviteData, setInviteData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    validateInvite()
  }, [token])

  const validateInvite = async() => {
    try {
      const response = await fetch(`/api/invites/validate/${token}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Invalid or expired invite')
        setValidating(false)
        return
      }

      const data = await response.json()
      setInviteData(data)
      setFormData(prev => ({ ...prev, email: data.inviterEmail || '' }))
    } catch (error) {
      console.error('[InviteForm] Validation error:', error)
      setError('Failed to validate invite')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async(e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required')
      setLoading(false)
      return
    }

    if (!formData.email.trim()) {
      setError('Email is required')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/invites/accept/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      if (data.success) {
        // Registration successful - redirect to app
        // The server should have created the session
        window.location.href = '/'
      }
    } catch (error) {
      console.error('[InviteForm] Registration error:', error)
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-md bg-primary text-primary-foreground flex items-center justify-center text-2xl border border-primary mb-4 animate-pulse">
            🎤
          </div>
          <p className="text-muted-foreground text-sm">Validating invite</p>
        </motion.div>
      </div>
    )
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full"
        >
          <Card className="border border-border bg-card shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 mx-auto rounded-md bg-destructive/15 border border-destructive/40 flex items-center justify-center text-destructive mb-4">
                <AlertCircle className="h-6 w-6" />
              </div>
              <CardTitle className="font-serif-display text-3xl">Invite invalid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full"
      >
        <Card className="border border-border bg-card shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 mx-auto rounded-md bg-primary text-primary-foreground flex items-center justify-center mb-4 border border-primary">
              <UserPlus className="h-6 w-6" />
            </div>
            <CardTitle className="font-serif-display text-3xl">Join {inviteData?.tenantName}</CardTitle>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>You've been invited by <strong>{inviteData?.inviterName}</strong></p>
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs">
                <Building className="h-3 w-3" />
                <span>{inviteData?.role} access</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    name="password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 h-11"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Join {inviteData?.tenantName}
                  </>
                )}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              <p>By joining, you agree to the terms and conditions.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}