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

  async register(
    name,
    email,
    password,
    tenantData = null,
    recaptchaToken = null
  ) {
    try {
      const requestBody = { name, email, password }

      // Add tenant data for multi-tenant registration
      if (tenantData) {
        requestBody.tenantName = tenantData.tenantName
        requestBody.subdomain = tenantData.subdomain
        requestBody.tier = tenantData.tier
      }

      // Add reCAPTCHA token if provided
      if (recaptchaToken) {
        requestBody.recaptchaToken = recaptchaToken
      }

      const response = await this.secureFetch(`${API_URL}/auth/register`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
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

  // Check multi-tenancy configuration
  async getMultiTenancyConfig() {
    try {
      const response = await fetch(`${API_URL}/config/multitenancy`)
      if (!response.ok) {
        throw new Error('Failed to get multi-tenancy config')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Multi-tenancy config error:', error)
      return { enabled: false, registrationEnabled: true }
    }
  }

  // Check reCAPTCHA configuration
  async getRecaptchaConfig() {
    try {
      const response = await fetch(`${API_URL}/config/recaptcha`)
      if (!response.ok) {
        throw new Error('Failed to get reCAPTCHA config')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] reCAPTCHA config error:', error)
      return { enabled: false, siteKey: null }
    }
  }

  // Get current tenant information
  async getTenantInfo() {
    try {
      const response = await this.secureFetch(`${API_URL}/tenant/info`)
      if (!response.ok) {
        if (response.status === 404) {
          return null // No tenant (single-tenant mode)
        }
        throw new Error('Failed to get tenant info')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Tenant info error:', error)
      return null
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
      // Server may return { redirectUrl } pointing to Zitadel end_session URL
      // for SSO logout. Caller is responsible for navigating to it.
      try {
        const data = await response.json()
        return data || { success: true }
      } catch (_e) {
        return { success: true }
      }
    } catch (error) {
      console.error('[API] Logout error:', error)
      return { success: false, error: error.message }
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

  // Admin-only. Returns the env-driven OIDC config for display in Settings.
  async getOIDCConfig() {
    try {
      const response = await fetch(`${API_URL}/auth/oidc/config`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to get OIDC config')
      }
      return await response.json()
    } catch (error) {
      console.error('[API] Get OIDC config error:', error)
      return { enabled: false, readonly: true }
    }
  }

  // Returns the URL the caller should navigate to in order to start the OIDC
  // hosted-login flow. The endpoint responds with a 302 to the Zitadel
  // authorize URL; navigating to it from the browser preserves the session
  // cookie that holds the PKCE verifier/state/nonce.
  initiateOIDCLogin() {
    return `${API_URL}/auth/oidc/login`
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

  // AI proxy endpoints (security: provider keys stay server-side)
  async testAIConnection(settings = {}) {
    try {
      const response = await this.secureFetch(`${API_URL}/ai/test-connection`, {
        method: 'POST',
        body: JSON.stringify(settings)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed')
      }
      return data
    } catch (error) {
      console.error('[API] AI connection test error:', error)
      throw error
    }
  }

  async aiChat(payload = {}) {
    try {
      const response = await this.secureFetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'AI chat request failed')
      }
      return data
    } catch (error) {
      console.error('[API] AI chat error:', error)
      throw error
    }
  }

  async aiTranscribe(formData) {
    try {
      const response = await fetch(`${API_URL}/ai/transcribe`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'AI transcription failed')
      }
      return data
    } catch (error) {
      console.error('[API] AI transcription error:', error)
      throw error
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

  /*
   * Delete a single task by ID. Mirrors deleteProject — direct DELETE
   * call rather than waiting on the project-save diff to pick up the
   * removal. Previously the only delete path was via the debounced
   * saveProject (100ms setTimeout) which could be canceled by other
   * actions or fail silently, leaving the task in the database. The
   * caller is expected to await this and only mutate local state when
   * it returns true.
   */
  async deleteTask(taskId) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/tasks/${taskId}`,
        {
          method: 'DELETE'
        }
      )
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Failed to delete task: ${response.status} - ${errorText}`
        )
      }
      return true
    } catch (error) {
      console.error('[API] Delete task error:', error)
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

  // Task similarity and merging endpoints
  async detectSimilarTasks(projectId) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/tasks/detect-similar`,
        {
          method: 'POST',
          body: JSON.stringify({ projectId })
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.groups || []
    } catch (error) {
      console.error('[API] Detect similar tasks error:', error)
      throw error
    }
  }

  async mergeTasks(projectId, taskIds, mergeStrategy = 'smart') {
    try {
      const response = await this.secureFetch(`${API_URL}/tasks/merge`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          taskIds,
          mergeStrategy
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        )
      }

      return await response.json()
    } catch (error) {
      console.error('[API] Merge tasks error:', error)
      throw error
    }
  }

  async undoMerge(projectId, mergeId) {
    try {
      const response = await this.secureFetch(`${API_URL}/tasks/undo-merge`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          mergeId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        )
      }

      return await response.json()
    } catch (error) {
      console.error('[API] Undo merge error:', error)
      throw error
    }
  }

  async getRecentMerges(projectId) {
    try {
      const response = await this.secureFetch(
        `${API_URL}/tasks/recent-merges/${projectId}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        )
      }

      const result = await response.json()
      return result.merges || []
    } catch (error) {
      console.error('[API] Get recent merges error:', error)
      throw error
    }
  }
}

export default new ApiService()
