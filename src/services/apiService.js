// Simple API service for backend communication
const API_URL = '/api'

class ApiService {
  // Authentication
  async getAuthStatus() {
    try {
      const response = await fetch(`${API_URL}/auth/status`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to get auth status')
      return await response.json()
    } catch (error) {
      console.error('[API] Get auth status error:', error)
      return { authenticated: false, hasUsers: true }
    }
  }

  async getCurrentUser() {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include'
      })
      if (!response.ok) {
        if (response.status === 401) return null
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
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Logout failed')
      return true
    } catch (error) {
      console.error('[API] Logout error:', error)
      return false
    }
  }

  // Settings
  async getSettings() {
    try {
      const response = await fetch(`${API_URL}/settings`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to get settings')
      return await response.json()
    } catch (error) {
      console.error('[API] Get settings error:', error)
      return null
    }
  }

  async saveSettings(settings) {
    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      })
      if (!response.ok) throw new Error('Failed to save settings')
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
      if (!response.ok) throw new Error('Failed to get projects')
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
      if (!response.ok) throw new Error('Failed to get project')
      return await response.json()
    } catch (error) {
      console.error('[API] Get project error:', error)
      return null
    }
  }

  async saveProject(project) {
    try {
      console.log('[API] Saving project:', project.id, project.name)
      console.log('[API] Project has', project.tasks?.length || 0, 'tasks')

      // Filter out meetings since they're saved separately via /api/meetings
      const projectData = {
        ...project,
        meetings: undefined // Remove meetings from project data
      }

      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[API] Save project failed - Status:', response.status)
        console.error('[API] Error response:', errorText)
        throw new Error(`Failed to save project: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('[API] ✓ Project saved successfully')
      return true
    } catch (error) {
      console.error('[API] Save project error:', error)
      console.error('[API] Error details:', error.message)
      return false
    }
  }

  async deleteProject(projectId) {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to delete project')
      return true
    } catch (error) {
      console.error('[API] Delete project error:', error)
      return false
    }
  }
}

export default new ApiService()
