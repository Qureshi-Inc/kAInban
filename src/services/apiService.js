// Simple API service for backend communication
const API_URL = '/api'

class ApiService {
  // Enhanced fetch with standard security headers
  async secureFetch(url, options = {}) {
    return await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
  }
  // Authentication
  async getAuthStatus() {
    try {
      const response = await fetch(`${API_URL}/auth/status`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to get auth status')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get auth status error:', error)
      return { authenticated: false, hasUsers: true }
    }
  }

  async getCurrentUser() {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          return null
        }
        throw new Error('Failed to get current user')
      }
      const data = await response.json()
      return data.user
    } catch (error) {
      console.error('[API] Get current user error:', error)
      return null
    }
  }

  async register(name, email, password) {
    try {
      const response = await this.secureFetch(`${API_URL}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      return data
    } catch (error) {
      console.error('[API] Register error:', error)
      throw error
    }
  }

  async login(email, password) {
    try {
      const response = await this.secureFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      return data
    } catch (error) {
      console.error('[API] Login error:', error)
      throw error
    }
  }

  async logout() {
    try {
      const response = await this.secureFetch(`${API_URL}/auth/logout`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Logout failed')
      }
      return true
    } catch (error) {
      console.error('[API] Logout error:', error)
      return false
    }
  }

  async getOIDCStatus() {
    try {
      const response = await fetch(`${API_URL}/auth/oidc/status`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to get OIDC status')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get OIDC status error:', error)
      return { enabled: false }
    }
  }

  async initiateOIDCLogin() {
    try {
      const response = await fetch(`${API_URL}/auth/oidc/login`, {
        credentials: 'include'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initiate OIDC login')
      }
      const data = await response.json()
      return data.authUrl
    } catch (error) {
      console.error('[API] OIDC login error:', error)
      throw error
    }
  }

  // Settings
  async getSettings() {
    try {
      const response = await fetch(`${API_URL}/settings`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to get settings')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get settings error:', error)
      return null
    }
  }

  async saveSettings(settings) {
    try {
      const response = await this.secureFetch(`${API_URL}/settings`, {
        method: 'POST',
        body: JSON.stringify(settings)
      })
      if (!response.ok) {
        throw new Error('Failed to save settings')
      }
      return true
    } catch (error) {
      console.error('[API] Save settings error:', error)
      return false
    }
  }

  // Projects
  async getAllProjects() {
    try {
      const response = await fetch(`${API_URL}/projects`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to get projects')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get projects error:', error)
      return []
    }
  }

  async getProject(projectId) {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to get project')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get project error:', error)
      return null
    }
  }

  async saveProject(project) {
    try {
      // Filter out meetings since they're saved separately via /api/meetings
      const projectData = {
        ...project,
        meetings: undefined // Remove meetings from project data
      }

      const response = await this.secureFetch(`${API_URL}/projects`, {
        method: 'POST',
        body: JSON.stringify(projectData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[API] Save project failed - Status:', response.status)
        console.error('[API] Error response:', errorText)
        throw new Error(
          `Failed to save project: ${response.status} - ${errorText}`
        )
      }

      await response.json()
      return true
    } catch (error) {
      console.error('[API] Save project error:', error)
      console.error('[API] Error details:', error.message)
      return false
    }
  }

  async deleteProject(projectId) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/projects/${projectId}`,
        {
          method: 'DELETE'
        }
      )
      if (!response.ok) {
        throw new Error('Failed to delete project')
      }
      return true
    } catch (error) {
      console.error('[API] Delete project error:', error)
      return false
    }
  }

  async deleteAllProjects() {
    try {
      const response = await this.secureFetch(`${API_URL}/projects`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete all projects: ${errorText}`)
      }
      const result = await response.json()
      return true
    } catch (error) {
      console.error('[API] Delete all projects error:', error)
      throw error
    }
  }

  // Analytics insights caching
  async saveAnalyticsInsights(projectId, insights, taskCount) {
    try {
      const response = await this.secureFetch(`${API_URL}/analytics/insights`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: projectId === 'all' ? null : projectId,
          insights,
          taskCount,
          timestamp: Date.now()
        })
      })
      if (!response.ok) {
        console.warn(
          '[API] Failed to save analytics insights to server, using localStorage fallback'
        )
        // Fallback to localStorage
        const cacheKey = `analytics_insights_cache_${projectId}`
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            insights,
            timestamp: Date.now(),
            taskCount
          })
        )
        return true
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Save analytics insights error:', error)
      // Fallback to localStorage
      try {
        const cacheKey = `analytics_insights_cache_${projectId}`
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            insights,
            timestamp: Date.now(),
            taskCount
          })
        )
        return true
      } catch (localError) {
        console.error('[API] localStorage fallback failed:', localError)
        return false
      }
    }
  }

  async loadAnalyticsInsights(projectId) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/analytics/insights/${projectId === 'all' ? 'all' : projectId}`
      )
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.warn(
        '[API] Failed to load analytics insights from server, trying localStorage:',
        error
      )
    }

    // Fallback to localStorage
    try {
      const cacheKey = `analytics_insights_cache_${projectId}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.error('[API] localStorage fallback failed:', error)
    }

    return null
  }

  async clearAnalyticsInsights(projectId) {
    try {
      // Clear from server
      await this.secureFetch(
        `${API_URL}/analytics/insights/${projectId === 'all' ? 'all' : projectId}`,
        {
          method: 'DELETE'
        }
      )
    } catch (error) {
      console.warn(
        '[API] Failed to clear analytics insights from server:',
        error
      )
    }

    // Always clear from localStorage as well
    try {
      const cacheKey = `analytics_insights_cache_${projectId}`
      localStorage.removeItem(cacheKey)
    } catch (error) {
      console.error('[API] Failed to clear localStorage cache:', error)
    }
  }

  async clearAllAnalyticsInsights() {
    try {
      // Clear all from server
      await this.secureFetch(`${API_URL}/analytics/insights`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.warn(
        '[API] Failed to clear all analytics insights from server:',
        error
      )
    }

    // Clear all localStorage analytics caches
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('analytics_insights_cache_')) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('[API] Failed to clear all localStorage caches:', error)
    }
  }

  // Task change tracking methods
  async getTaskChanges(taskId, limit = 50) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/tasks/${taskId}/changes?limit=${limit}`
      )
      if (!response.ok) {
        throw new Error('Failed to get task changes')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get task changes error:', error)
      return []
    }
  }

  async getProjectChanges(projectId, limit = 100) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/projects/${projectId}/changes?limit=${limit}`
      )
      if (!response.ok) {
        throw new Error('Failed to get project changes')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get project changes error:', error)
      return []
    }
  }

  // Task comments methods
  async getTaskComments(taskId, limit = 50) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/tasks/${taskId}/comments?limit=${limit}`
      )
      if (!response.ok) {
        throw new Error('Failed to get task comments')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get task comments error:', error)
      return []
    }
  }

  async addTaskComment(taskId, content, commentType = 'user', metadata = null) {
    try {
      // Use bulletproof endpoint for AI comments
      if (commentType === 'ai_update') {
        const response = await this.secureFetch(
          `${API_URL}/tasks/${taskId}/ai-comments-bulletproof`,
          {
            method: 'POST',
            body: JSON.stringify({ content, metadata })
          }
        )
        if (!response.ok) {
          throw new Error(`AI comment failed: ${response.status}`)
        }
        const result = await response.json()
        return result
      }

      // Use regular endpoint for user comments
      const response = await this.secureFetch(
        `${API_URL}/tasks/${taskId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content, commentType, metadata })
        }
      )
      if (!response.ok) {
        throw new Error('Failed to add comment')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Add comment error:', error)
      return { success: false, error: error.message }
    }
  }

  async addAtomicAIComment(taskId, content, metadata = null) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/tasks/${taskId}/ai-comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content, metadata })
        }
      )
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add AI comment')
      }
      const result = await response.json()
      return result
    } catch (error) {
      console.error('[API] Atomic AI comment error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateTaskComment(commentId, content) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/comments/${commentId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content })
        }
      )
      if (!response.ok) {
        throw new Error('Failed to update comment')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Update comment error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteTaskComment(commentId) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/comments/${commentId}`,
        {
          method: 'DELETE'
        }
      )
      if (!response.ok) {
        throw new Error('Failed to delete comment')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Delete comment error:', error)
      return { success: false, error: error.message }
    }
  }

  async getUsers() {
    try {
      const response = await this.secureFetch(`${API_URL}/users`)
      if (!response.ok) {
        throw new Error('Failed to get users')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get users error:', error)
      return []
    }
  }
}

export default new ApiService()
