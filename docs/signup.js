// PocketID Signup Integration for kAInban Landing Page
class PocketIDSignup {
  constructor(config) {
    this.pocketIdUrl = config.pocketIdUrl || 'https://login.qureshi.io'
    this.kainbanUrl = config.kainbanUrl || 'https://app.kainban.com'
    this.apiEndpoint = config.apiEndpoint || 'https://app.kainban.com/api'
    this.signupPageUrl = config.signupPageUrl || 'https://login.qureshi.io/signup'
  }

  // Method 1: Direct redirect to PocketID with return URL (most PocketID instances don't support direct registration)
  async signupWithRedirect(_email, _name) {
    // Skip direct redirect method as most PocketID instances don't support /register endpoint
    // Instead, we'll throw an error to fall back to invitation email method
    throw new Error('Direct PocketID redirect not supported')
  }

  // Method 2: Send invitation email via your backend
  async sendInvitation(email, name) {
    try {
      const response = await fetch(`${this.apiEndpoint}/auth/send-pocketid-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          name,
          returnUrl: `${this.kainbanUrl}/welcome`
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send invitation')
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('Invitation failed:', error)
      throw error
    }
  }

  // Create signup intent (tracks user through the flow)
  async createSignupIntent(email, name) {
    const response = await fetch(`${this.apiEndpoint}/auth/create-signup-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        name,
        source: 'landing_page',
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create signup intent')
    }

    return await response.json()
  }

  // Method 3: Magic link approach (fallback)
  async sendMagicLink(email, name) {
    try {
      const response = await fetch(`${this.apiEndpoint}/auth/send-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          name,
          type: 'signup',
          redirectUrl: `${this.kainbanUrl}/dashboard`
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send magic link')
      }

      return await response.json()

    } catch (error) {
      console.error('Magic link failed:', error)
      throw error
    }
  }
}

// Signup form handler
class SignupForm {
  constructor(formId, pocketIdSignup) {
    this.form = document.getElementById(formId)
    this.pocketIdSignup = pocketIdSignup
    this.init()
  }

  init() {
    if (!this.form) {return}

    this.form.addEventListener('submit', this.handleSubmit.bind(this))
    this.setupRealTimeValidation()
  }

  async handleSubmit(event) {
    event.preventDefault()

    const formData = new FormData(this.form)
    const email = formData.get('email')
    const name = '' // Only collecting email, not name
    const plan = formData.get('plan') || 'free'

    // Validate inputs
    if (!this.validateEmail(email)) {
      this.showError('Please enter a valid email address')
      return
    }

    // Show loading state
    this.setLoading(true)

    try {
      // Try different signup methods in order of preference
      await this.attemptSignup(email, name, plan)

    } catch (error) {
      this.showError(error.message)
      this.setLoading(false)
    }
  }

  async attemptSignup(email, name, _plan) {
    try {
      // Method 1: Try invitation email (primary method)
      const result = await this.pocketIdSignup.sendInvitation(email, name)

      // Check if email was actually sent or just providing instructions
      if (result.method === 'email') {
        this.showSuccess(`
          <div class="signup-success">
            <h4>✅ Almost there!</h4>
            <p>We've sent setup instructions to <strong>${email}</strong></p>
            <p><small>Check your email and follow the instructions to complete your account setup.</small></p>
          </div>
        `)
      } else {
        // Fallback to manual instructions with better messaging
        this.showManualInstructions(email, result.registrationLink)
      }

    } catch (inviteError) {
      console.warn('Invitation failed:', inviteError)

      try {
        // Method 2: Try magic link
        await this.pocketIdSignup.sendMagicLink(email, name)
        this.showSuccess('Magic link sent! Check your email to complete setup.')

      } catch (magicError) {
        console.warn('Magic link failed:', magicError)

        // Method 3: Manual instructions as final fallback
        this.showManualInstructions(email)
      }
    }
  }

  showManualInstructions(email, registrationLink) {
    const pocketIdUrl = registrationLink || 'https://login.qureshi.io'
    const message = `
      <div class="manual-signup">
        <h4>🔐 Complete Your Signup</h4>
        <p>No email? No problem! Follow these simple steps:</p>
        <ol>
          <li>Click the button below to visit PocketID</li>
          <li>Create account with email: <strong>${email}</strong></li>
          <li>Enable passkey in Security settings (recommended)</li>
          <li>Return to <a href="https://app.kainban.com" target="_blank">kAInban</a> and sign in</li>
        </ol>
        <div style="margin: 20px 0;">
          <a href="${pocketIdUrl}" target="_blank" class="btn-primary" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Create PocketID Account →
          </a>
        </div>
        <p style="font-size: 14px; color: #666;">PocketID provides secure, passwordless authentication using Face ID, Touch ID, or Windows Hello.</p>
      </div>
    `
    this.showSuccess(message)
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  setupRealTimeValidation() {
    const emailInput = this.form.querySelector('input[name="email"]')
    if (emailInput) {
      emailInput.addEventListener('blur', () => {
        const email = emailInput.value
        if (email && !this.validateEmail(email)) {
          this.showFieldError(emailInput, 'Please enter a valid email address')
        } else {
          this.clearFieldError(emailInput)
        }
      })
    }
  }

  setLoading(loading) {
    const submitBtn = this.form.querySelector('button[type="submit"]')
    const spinner = this.form.querySelector('.loading-spinner')

    if (submitBtn) {
      submitBtn.disabled = loading
      submitBtn.textContent = loading ? 'Creating Account...' : 'Get Started Free'
    }

    if (spinner) {
      spinner.style.display = loading ? 'inline-block' : 'none'
    }
  }

  showError(message) {
    this.showMessage(message, 'error')
  }

  showSuccess(message) {
    this.showMessage(message, 'success')
  }

  showMessage(message, type) {
    // Remove existing messages
    const existingMessage = this.form.querySelector('.signup-message')
    if (existingMessage) {
      existingMessage.remove()
    }

    // Create new message
    const messageDiv = document.createElement('div')
    messageDiv.className = `signup-message ${type}`
    messageDiv.innerHTML = message

    // Insert after form
    this.form.parentNode.insertBefore(messageDiv, this.form.nextSibling)

    // Auto-hide error messages after 10 seconds
    if (type === 'error') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove()
        }
      }, 10000)
    }
  }

  showFieldError(field, message) {
    this.clearFieldError(field)

    const errorDiv = document.createElement('div')
    errorDiv.className = 'field-error'
    errorDiv.textContent = message

    field.parentNode.appendChild(errorDiv)
    field.classList.add('error')
  }

  clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error')
    if (existingError) {
      existingError.remove()
    }
    field.classList.remove('error')
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize PocketID signup handler
  const pocketIdSignup = new PocketIDSignup({
    pocketIdUrl: 'https://login.qureshi.io',
    kainbanUrl: 'https://app.kainban.com',
    apiEndpoint: 'https://app.kainban.com/api'
  })

  // Initialize signup forms
  new SignupForm('hero-signup-form', pocketIdSignup)
  new SignupForm('pricing-signup-form', pocketIdSignup)

  // Handle pricing plan selection
  document.querySelectorAll('[data-plan]').forEach(button => {
    button.addEventListener('click', (e) => {
      const plan = e.target.dataset.plan
      const form = document.getElementById('hero-signup-form')
      if (form) {
        const planInput = form.querySelector('input[name="plan"]')
        if (planInput) {
          planInput.value = plan
        }
      }
    })
  })
})