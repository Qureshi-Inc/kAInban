// Google reCAPTCHA v3 verification service
import fetch from 'node-fetch'

class RecaptchaService {
  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY
    this.siteKey = process.env.RECAPTCHA_SITE_KEY
    this.scoreThreshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD) || 0.5
    this.verifyUrl = 'https://www.google.com/recaptcha/api/siteverify'
  }

  // Check if reCAPTCHA is enabled
  isEnabled() {
    // TEMPORARILY DISABLED FOR TESTING
    return false
    // return !!(this.secretKey && this.siteKey)
  }

  // Get the site key for frontend
  getSiteKey() {
    return this.siteKey
  }

  // Verify reCAPTCHA token from frontend
  async verifyToken(token, remoteIp = null) {
    if (!this.isEnabled()) {
      console.log('[reCAPTCHA] Service not enabled - skipping verification')
      return { success: true, score: 1.0, action: 'disabled' }
    }

    if (!token) {
      return { success: false, error: 'reCAPTCHA token is required', score: 0 }
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token
      })

      if (remoteIp) {
        params.append('remoteip', remoteIp)
      }

      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      const result = await response.json()

      console.log('[reCAPTCHA] Verification result:', {
        success: result.success,
        score: result.score,
        action: result.action,
        threshold: this.scoreThreshold,
        hostname: result.hostname
      })

      if (!result.success) {
        return {
          success: false,
          error: 'reCAPTCHA verification failed',
          errorCodes: result['error-codes'],
          score: 0
        }
      }

      // Check score against threshold (v3 only)
      if (result.score !== undefined) {
        const scoreOk = result.score >= this.scoreThreshold
        return {
          success: scoreOk,
          score: result.score,
          action: result.action,
          hostname: result.hostname,
          error: scoreOk ? null : `reCAPTCHA score too low: ${result.score} < ${this.scoreThreshold}`
        }
      }

      // v2 verification (no score)
      return {
        success: true,
        score: 1.0,
        action: result.action || 'legacy',
        hostname: result.hostname
      }

    } catch (error) {
      console.error('[reCAPTCHA] Verification error:', error)
      return {
        success: false,
        error: 'reCAPTCHA verification service unavailable',
        score: 0
      }
    }
  }

  // Get configuration for frontend
  getConfig() {
    return {
      enabled: this.isEnabled(),
      siteKey: this.siteKey,
      scoreThreshold: this.scoreThreshold
    }
  }
}

export default new RecaptchaService()