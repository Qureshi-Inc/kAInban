import { useState, useEffect } from 'react'
import apiService from '../services/apiService'

export const useRecaptcha = () => {
  const [recaptchaConfig, setRecaptchaConfig] = useState({
    enabled: false,
    siteKey: null,
    loaded: false,
    error: null
  })

  useEffect(() => {
    loadRecaptchaConfig()
  }, [])

  const loadRecaptchaConfig = async () => {
    try {
      const config = await apiService.getRecaptchaConfig()
      setRecaptchaConfig(prev => ({
        ...prev,
        enabled: config.enabled,
        siteKey: config.siteKey
      }))

      // Load reCAPTCHA script if enabled
      if (config.enabled && config.siteKey) {
        await loadRecaptchaScript(config.siteKey)
      } else {
        setRecaptchaConfig(prev => ({ ...prev, loaded: true }))
      }
    } catch (error) {
      console.error('[reCAPTCHA] Failed to load config:', error)
      setRecaptchaConfig(prev => ({
        ...prev,
        error: 'Failed to load reCAPTCHA configuration',
        loaded: true
      }))
    }
  }

  const loadRecaptchaScript = (siteKey) => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.grecaptcha) {
        setRecaptchaConfig(prev => ({ ...prev, loaded: true }))
        resolve()
        return
      }

      // Check if script is already being loaded
      if (document.querySelector('script[src*="recaptcha"]')) {
        // Wait for existing script to load
        const checkLoaded = setInterval(() => {
          if (window.grecaptcha) {
            clearInterval(checkLoaded)
            setRecaptchaConfig(prev => ({ ...prev, loaded: true }))
            resolve()
          }
        }, 100)

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkLoaded)
          setRecaptchaConfig(prev => ({
            ...prev,
            error: 'reCAPTCHA script load timeout',
            loaded: true
          }))
          reject(new Error('reCAPTCHA script load timeout'))
        }, 10000)
        return
      }

      // Load the script
      const script = document.createElement('script')
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      script.async = true
      script.defer = true

      script.onload = () => {
        // Wait for grecaptcha to be available
        const checkReady = setInterval(() => {
          if (window.grecaptcha && window.grecaptcha.ready) {
            clearInterval(checkReady)
            window.grecaptcha.ready(() => {
              setRecaptchaConfig(prev => ({ ...prev, loaded: true }))
              resolve()
            })
          }
        }, 100)

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkReady)
          setRecaptchaConfig(prev => ({
            ...prev,
            error: 'reCAPTCHA initialization timeout',
            loaded: true
          }))
          reject(new Error('reCAPTCHA initialization timeout'))
        }, 10000)
      }

      script.onerror = () => {
        setRecaptchaConfig(prev => ({
          ...prev,
          error: 'Failed to load reCAPTCHA script',
          loaded: true
        }))
        reject(new Error('Failed to load reCAPTCHA script'))
      }

      document.head.appendChild(script)
    })
  }

  const executeRecaptcha = async (action = 'submit') => {
    if (!recaptchaConfig.enabled) {
      console.log('[reCAPTCHA] reCAPTCHA not enabled, skipping')
      return null
    }

    if (!recaptchaConfig.loaded) {
      console.warn('[reCAPTCHA] reCAPTCHA not loaded yet')
      return null
    }

    if (!window.grecaptcha) {
      console.error('[reCAPTCHA] grecaptcha not available')
      return null
    }

    try {
      return await window.grecaptcha.execute(recaptchaConfig.siteKey, { action })
    } catch (error) {
      console.error('[reCAPTCHA] Execute error:', error)
      return null
    }
  }

  return {
    ...recaptchaConfig,
    executeRecaptcha
  }
}