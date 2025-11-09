// Simple API service for backend communication
const API_URL = '/api'

class ApiService {
  // Settings
  async getSettings() {
    try {
      const response = await fetch(`${API_URL}/settings`)
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
      const response = await fetch(`${API_URL}/projects`)
      if (!response.ok) throw new Error('Failed to get projects')
      return await response.json()
    } catch (error) {
      console.error('[API] Get projects error:', error)
      return []
    }
  }

  async getProject(projectId) {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`)
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
        method: 'DELETE'
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
