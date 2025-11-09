// Storage service that abstracts localStorage and backend API storage

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND_STORAGE === 'true'

class StorageService {
  constructor() {
    this.useBackend = USE_BACKEND
    console.log('[StorageService] Using backend storage:', this.useBackend)
  }

  async getItem(key) {
    if (this.useBackend) {
      try {
        const response = await fetch(`${API_URL}/api/storage/${key}`)
        if (response.ok) {
          return await response.json()
        }
        return null
      } catch (error) {
        console.error('[StorageService] Backend get error:', error)
        // Fallback to localStorage
        const data = localStorage.getItem(key)
        return data ? JSON.parse(data) : null
      }
    } else {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    }
  }

  async setItem(key, value) {
    if (this.useBackend) {
      try {
        const response = await fetch(`${API_URL}/api/storage/${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value)
        })

        if (!response.ok) {
          throw new Error('Backend save failed')
        }

        // Also save to localStorage as backup
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (error) {
        console.error('[StorageService] Backend save error:', error)
        // Fallback to localStorage only
        localStorage.setItem(key, JSON.stringify(value))
        return false
      }
    } else {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    }
  }

  async removeItem(key) {
    if (this.useBackend) {
      try {
        await fetch(`${API_URL}/api/storage/${key}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.error('[StorageService] Backend delete error:', error)
      }
    }
    localStorage.removeItem(key)
  }

  async getAllKeys() {
    if (this.useBackend) {
      try {
        const response = await fetch(`${API_URL}/api/storage/keys`)
        if (response.ok) {
          const data = await response.json()
          return data.keys
        }
      } catch (error) {
        console.error('[StorageService] Backend keys error:', error)
      }
    }

    // Fallback to localStorage
    return Object.keys(localStorage)
  }

  async exportAll() {
    if (this.useBackend) {
      try {
        const response = await fetch(`${API_URL}/api/storage/export/all`)
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.error('[StorageService] Backend export error:', error)
      }
    }

    // Fallback to localStorage
    const allData = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const value = localStorage.getItem(key)
      try {
        allData[key] = JSON.parse(value)
      } catch (e) {
        allData[key] = value
      }
    }
    return allData
  }

  // Check if backend is available
  async checkBackend() {
    try {
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      })
      return response.ok
    } catch (error) {
      return false
    }
  }
}

// Create custom storage adapter for Zustand
// Zustand persist requires synchronous storage for proper hydration
export const createCustomStorage = () => {
  return {
    getItem: (name) => {
      try {
        const value = localStorage.getItem(name)
        console.log('[StorageAdapter] getItem called:', name, value ? 'found' : 'not found')
        return value
      } catch (error) {
        console.error('[StorageAdapter] getItem error:', error)
        return null
      }
    },
    setItem: (name, value) => {
      try {
        console.log('[StorageAdapter] setItem called:', name, typeof value)
        localStorage.setItem(name, value)
      } catch (error) {
        console.error('[StorageAdapter] setItem error:', error)
      }
    },
    removeItem: (name) => {
      try {
        console.log('[StorageAdapter] removeItem called:', name)
        localStorage.removeItem(name)
      } catch (error) {
        console.error('[StorageAdapter] removeItem error:', error)
      }
    }
  }
}

export default new StorageService()