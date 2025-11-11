import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import apiService from '../services/apiService'

export default function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [error, setError] = useState('')
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check if this is the first user
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const status = await apiService.getAuthStatus()
      setIsFirstUser(!status.hasUsers)
      if (!status.hasUsers) {
        setMode('register')
      }
    } catch (error) {
      console.error('[Auth] Failed to check status:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleLogin = async (email, password) => {
    setError('')
    try {
      const response = await apiService.login(email, password)
      if (response.success) {
        onAuthSuccess(response.user)
      }
    } catch (error) {
      setError(error.message || 'Login failed')
    }
  }

  const handleRegister = async (name, email, password) => {
    setError('')
    try {
      const response = await apiService.register(name, email, password)
      if (response.success) {
        onAuthSuccess(response.user)
      }
    } catch (error) {
      setError(error.message || 'Registration failed')
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4 animate-pulse">
            🎤
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      {mode === 'login' && !isFirstUser ? (
        <LoginForm
          onLogin={handleLogin}
          onSwitchToRegister={() => {
            setMode('register')
            setError('')
          }}
          error={error}
        />
      ) : (
        <RegisterForm
          onRegister={handleRegister}
          onSwitchToLogin={() => {
            setMode('login')
            setError('')
          }}
          error={error}
          isFirstUser={isFirstUser}
        />
      )}
    </div>
  )
}
