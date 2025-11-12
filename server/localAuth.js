import { hash, verify } from '@node-rs/argon2'
import validator from 'validator'
import * as db from './database.js'

// Argon2 configuration (OWASP recommended settings)
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
}

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password) {
  return await hash(password, ARGON2_OPTIONS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(hash, password) {
  try {
    return await verify(hash, password)
  } catch (error) {
    console.error('[Auth] Password verification error:', error)
    return false
  }
}

/**
 * Validate email format
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }

  if (!validator.isEmail(email)) {
    return { valid: false, error: 'Invalid email format' }
  }

  // Normalize email
  const normalized = validator.normalizeEmail(email, {
    gmail_remove_dots: false, // Keep dots for Gmail (user choice)
    gmail_remove_subaddress: false, // Keep + addressing
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
  })

  return { valid: true, email: normalized }
}

/**
 * Validate password strength
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' }
  }

  // Check for at least one number, one uppercase, one lowercase
  const hasNumber = /\d/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)

  if (!hasNumber || !hasUpper || !hasLower) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
  }

  return { valid: true }
}

/**
 * Validate name
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' }
  }

  const trimmed = name.trim()

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' }
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Name must be less than 100 characters' }
  }

  return { valid: true, name: trimmed }
}

/**
 * Register a new local user
 */
export async function registerUser({ email, password, name }) {
  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error)
  }

  // Validate password
  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error)
  }

  // Validate name
  const nameValidation = validateName(name)
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error)
  }

  // Check if email already exists
  const existingUser = db.getUserByEmail(emailValidation.email)
  if (existingUser) {
    throw new Error('Email already registered')
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Determine if this is the first user (make them admin)
  const isFirstUser = !db.hasUsers()

  // Create user
  const user = db.createUser({
    email: emailValidation.email,
    email_verified: 0, // Email verification can be added later
    name: nameValidation.name,
    role: isFirstUser ? 'admin' : 'member',
    auth_provider: 'local',
    password_hash: passwordHash,
  })

  console.log('[LocalAuth] User registered:', user.email, 'Role:', user.role)

  return user
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(email, password) {
  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    throw new Error('Invalid email or password')
  }

  // Get user by email
  const user = db.getUserByEmail(emailValidation.email)
  if (!user) {
    // Still hash to prevent timing attacks
    await hash('dummy-password', ARGON2_OPTIONS)
    throw new Error('Invalid email or password')
  }

  // Check if user is local auth
  if (user.auth_provider !== 'local') {
    throw new Error(`This account uses ${user.auth_provider} authentication`)
  }

  // Verify password
  const isValid = await verifyPassword(user.password_hash, password)
  if (!isValid) {
    throw new Error('Invalid email or password')
  }

  // Update last login
  db.updateUserLogin(user.id)


  return user
}

/**
 * Change user password
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = db.getUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  if (user.auth_provider !== 'local') {
    throw new Error('Cannot change password for non-local users')
  }

  // Verify current password
  const isValid = await verifyPassword(user.password_hash, currentPassword)
  if (!isValid) {
    throw new Error('Current password is incorrect')
  }

  // Validate new password
  const passwordValidation = validatePassword(newPassword)
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error)
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword)

  // Update password
  db.updateUser(userId, { password_hash: newPasswordHash })

  console.log('[LocalAuth] Password changed for user:', user.email)

  return true
}

/**
 * Format user for session (remove sensitive data)
 */
export function formatUserForSession(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: user.auth_provider,
    email_verified: !!user.email_verified,
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  next()
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export default {
  hashPassword,
  verifyPassword,
  validateEmail,
  validatePassword,
  validateName,
  registerUser,
  authenticateUser,
  changePassword,
  formatUserForSession,
  requireAuth,
  requireAdmin,
}
