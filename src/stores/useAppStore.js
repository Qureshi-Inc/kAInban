import { create } from 'zustand'
import { generateId } from '@/lib/utils'
import apiService from '@/services/apiService'

const useAppStore = create((set, get) => ({
  // Authentication
  user: null,
  authChecked: false,

  // Settings
  settings: {
    azureEndpoint: '',
    apiKey: '',
    apiVersion: '2024-02-01',
    whisperDeployment: 'whisper-1',
    gptDeployment: 'gpt-4',
  },
  settingsLoaded: false,

  // Projects
  projects: [],
  currentProject: null,

  // Meetings (recordings/uploads within a project)
  meetings: [],
  selectedMeetingId: null,

  // Audio & Transcription
  isRecording: false,
  isPaused: false,
  recordingTime: 0,

  // Tasks
  tasks: [],

  // UI State
  isSettingsOpen: false,
  isRecordingModalOpen: false,
  notifications: [],

  // Progress tracking for file upload/processing
  uploadProgress: {
    stage: 'idle', // idle, uploading, converting, transcribing, extracting, complete, error
    percentage: 0,
    message: '',
    error: null
  },

  // Authentication Actions
  checkAuth: async () => {
    console.log('[Store] Starting auth check...')
    try {
      const user = await apiService.getCurrentUser()
      set({ user, authChecked: true })
      console.log('[Store] Auth check complete:', user ? user.email : 'not authenticated')
      return user
    } catch (error) {
      console.error('[Store] Auth check error:', error)
      // Make sure we always set authChecked to true even on error
      set({ user: null, authChecked: true })
      return null
    }
  },

  setUser: (user) => {
    set({ user })
  },

  logout: async () => {
    try {
      await apiService.logout()
      set({ user: null, currentProject: null, projects: [], tasks: [], meetings: [] })
      console.log('[Store] Logged out successfully')
    } catch (error) {
      console.error('[Store] Logout error:', error)
    }
  },

  // Initialize - Load data from backend
  initialize: async () => {
    console.log('[Store] Initializing from backend...')

    try {
      // Load settings
      const settings = await apiService.getSettings()
      if (settings) {
        set({ settings, settingsLoaded: true })
        console.log('[Store] Settings loaded from backend')
      } else {
        set({ settingsLoaded: true })
      }

      // Load projects
      const projects = await apiService.getAllProjects()

      // For each project, if it doesn't have tasks populated, try to load them
      const projectsWithTasks = await Promise.all(
        projects.map(async (project) => {
          // If the project already has tasks, use it as-is
          if (project.tasks && project.tasks.length > 0) {
            return project
          }
          // Otherwise, try to load the full project data including tasks
          try {
            const fullProject = await apiService.getProject(project.id)
            return fullProject || project
          } catch (error) {
            console.error('[Store] Error loading project details for', project.id, error)
            return project
          }
        })
      )

      set({ projects: projectsWithTasks })
      console.log(`[Store] Loaded ${projectsWithTasks.length} projects from backend`)

      // Restore last selected project from localStorage
      const lastProjectId = localStorage.getItem('lastSelectedProject')
      const lastMeetingId = localStorage.getItem('lastSelectedMeeting')
      if (lastProjectId && projectsWithTasks.some(p => p.id === lastProjectId)) {
        console.log('[Store] Restoring last selected project:', lastProjectId)
        // Use the already loaded project data
        const project = projectsWithTasks.find(p => p.id === lastProjectId)
        if (project) {
          // Check if the last selected meeting still exists in this project
          const meetingExists = project.meetings && project.meetings.some(m => m.id === lastMeetingId)
          const selectedMeetingId = meetingExists ? lastMeetingId : null

          set({
            currentProject: project,
            tasks: project.tasks || [],
            meetings: project.meetings || [],
            selectedMeetingId: selectedMeetingId
          })
          console.log('[Store] ✓ Project restored from initialization:', project.name)
          if (selectedMeetingId) {
            console.log('[Store] ✓ Meeting restored:', selectedMeetingId)
          }
        }
      }

      console.log('[Store] ✓ Initialization complete')
    } catch (error) {
      console.error('[Store] Initialization error:', error)
      console.error('[Store] Error stack:', error.stack)
      set({ settingsLoaded: true })
      throw error
    }
  },

  // Settings Actions
  updateSettings: async (newSettings) => {
    const settings = { ...get().settings, ...newSettings }
    set({ settings })

    // Save to backend
    await apiService.saveSettings(settings)
    console.log('[Store] Settings saved to backend')
  },

  // Project Actions
  createProject: async (name) => {
    const project = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tasks: [],
      transcript: '',
      summary: ''
    }

    console.log('[Store] Creating project:', project.name)
    set((state) => ({
      projects: [...state.projects, project],
      currentProject: project,
      tasks: [],
      meetings: [],
      selectedMeetingId: null
    }))

    // Save to localStorage for persistence
    localStorage.setItem('lastSelectedProject', project.id)
    console.log('[Store] Saved new project selection to localStorage')

    // Save to backend
    await apiService.saveProject(project)
    console.log('[Store] Project saved to backend')

    return project
  },

  loadProject: async (projectId) => {
    console.log('[Store] ===== LOADING PROJECT =====')
    console.log('[Store] Project ID:', projectId)
    console.log('[Store] Current tasks before load:', get().tasks.length)

    const project = await apiService.getProject(projectId)

    if (project) {
      console.log('[Store] Project data received from backend')
      console.log('[Store] Project name:', project.name)
      console.log('[Store] Tasks in project:', project.tasks?.length || 0)
      console.log('[Store] Project tasks:', project.tasks)

      set((state) => ({
        currentProject: project,
        tasks: project.tasks || [],
        meetings: project.meetings || [],
        selectedMeetingId: null,
        // Update the projects array with the loaded project data including tasks
        projects: state.projects.map(p =>
          p.id === projectId ? { ...project, lastModified: project.lastModified || new Date().toISOString() } : p
        )
      }))

      // Save to localStorage for persistence across refreshes
      localStorage.setItem('lastSelectedProject', projectId)
      // Clear last selected meeting when switching projects
      localStorage.removeItem('lastSelectedMeeting')
      console.log('[Store] Saved project selection to localStorage')

      console.log('[Store] Project state updated')
      console.log('[Store] Current tasks after load:', get().tasks.length)
      console.log('[Store] ✓ Project loaded:', project.name)
    } else {
      console.error('[Store] ✗ Project not found:', projectId)
    }
  },

  updateCurrentProject: async () => {
    const { currentProject, tasks, meetings } = get()
    if (!currentProject) return

    const updatedProject = {
      ...currentProject,
      tasks,
      meetings,
      lastModified: new Date().toISOString()
    }

    set((state) => ({
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === currentProject.id ? updatedProject : p
      )
    }))

    // Save to backend
    await apiService.saveProject(updatedProject)
    console.log('[Store] Project updated in backend')
  },

  deleteProject: async (projectId) => {
    const wasCurrentProject = get().currentProject?.id === projectId

    set((state) => ({
      projects: state.projects.filter(p => p.id !== projectId),
      currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      tasks: state.currentProject?.id === projectId ? [] : state.tasks,
      meetings: state.currentProject?.id === projectId ? [] : state.meetings,
      selectedMeetingId: state.currentProject?.id === projectId ? null : state.selectedMeetingId
    }))

    // Clear localStorage if this was the current project
    if (wasCurrentProject) {
      localStorage.removeItem('lastSelectedProject')
      console.log('[Store] Cleared project selection from localStorage')
    }

    // Delete from backend
    await apiService.deleteProject(projectId)
    console.log('[Store] Project deleted from backend')
  },

  // Recording Actions
  setRecording: (isRecording) => set({ isRecording }),
  setPaused: (isPaused) => set({ isPaused }),
  setRecordingTime: (time) => set({ recordingTime: time }),
  setRecordingModalOpen: (open) => set({ isRecordingModalOpen: open }),

  // Meeting Actions
  createMeeting: async (name, transcript, summary) => {
    const meeting = {
      id: generateId(),
      name,
      transcript: transcript || '',
      summary: summary || '',
      createdAt: new Date().toISOString(),
      projectId: get().currentProject?.id || null,
      summaryFile: null // Will store the file path on backend
    }

    console.log('[Store] Creating meeting:', meeting.name)

    try {
      // Save summary as file to backend
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: meeting.id,
          name: meeting.name,
          summary: meeting.summary,
          transcript: meeting.transcript,
          createdAt: meeting.createdAt,
          projectId: meeting.projectId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save meeting to backend')
      }

      const savedMeeting = await response.json()
      meeting.summaryFile = savedMeeting.summaryFile // Get file path from backend

      console.log('[Store] Meeting saved to backend:', meeting.name)
    } catch (error) {
      console.error('[Store] Failed to save meeting to backend:', error)
      // Continue with local storage for now
    }

    set((state) => ({
      meetings: [...state.meetings, meeting],
      selectedMeetingId: meeting.id
    }))

    get().updateCurrentProject()
    return meeting
  },

  selectMeeting: (meetingId) => {
    console.log('[Store] Selecting meeting:', meetingId)
    set({ selectedMeetingId: meetingId })

    // Save to localStorage for persistence across refreshes
    if (meetingId) {
      localStorage.setItem('lastSelectedMeeting', meetingId)
      console.log('[Store] Saved meeting selection to localStorage')
    } else {
      localStorage.removeItem('lastSelectedMeeting')
      console.log('[Store] Cleared meeting selection from localStorage')
    }
  },

  deleteMeeting: async (meetingId) => {
    console.log('[Store] Deleting meeting:', meetingId)
    const wasSelected = get().selectedMeetingId === meetingId

    try {
      // Delete from backend
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete meeting from backend')
      }

      console.log('[Store] Meeting deleted from backend:', meetingId)
    } catch (error) {
      console.error('[Store] Failed to delete meeting from backend:', error)
      // Continue with local deletion even if backend fails
    }

    set((state) => ({
      meetings: state.meetings.filter(m => m.id !== meetingId),
      selectedMeetingId: wasSelected ? null : state.selectedMeetingId
    }))

    // Clear from localStorage if this was the selected meeting
    if (wasSelected) {
      localStorage.removeItem('lastSelectedMeeting')
      console.log('[Store] Cleared meeting selection from localStorage')
    }

    get().updateCurrentProject()
  },

  getSelectedMeeting: () => {
    const { meetings, selectedMeetingId } = get()
    return meetings.find(m => m.id === selectedMeetingId) || null
  },

  // Task Actions
  addTask: (task) => {
    const newTask = {
      id: generateId(),
      title: task.title || 'Untitled Task',
      description: task.description || '',
      priority: task.priority || 'medium',
      subtasks: task.subtasks || [],
      comments: task.comments || [],
      status: 'todo',
      createdAt: new Date().toISOString(),
      dueDate: task.dueDate || null,
      projectId: get().currentProject?.id || null,
      ...task
    }

    console.log('[Store] ⊕ ADDING NEW TASK')
    console.log('[Store] Task ID:', newTask.id)
    console.log('[Store] Title:', newTask.title)
    console.log('[Store] Status:', newTask.status)
    console.log('[Store] Priority:', newTask.priority)
    console.log('[Store] Tasks before add:', get().tasks.length)

    set((state) => ({ tasks: [...state.tasks, newTask] }))

    console.log('[Store] Tasks after add:', get().tasks.length)
    console.log('[Store] ✓ Task added successfully')

    get().updateCurrentProject()
    return newTask
  },

  updateTask: (taskId, updates) => {
    const taskBefore = get().tasks.find(t => t.id === taskId)

    if (!taskBefore) {
      console.error('[Store] ✗ UPDATE FAILED: Task not found:', taskId)
      return
    }

    console.log('[Store] ✎ UPDATING TASK')
    console.log('[Store] Task ID:', taskId)
    console.log('[Store] Task title:', taskBefore.title)
    console.log('[Store] Current status:', taskBefore.status)
    console.log('[Store] New updates:', updates)
    console.log('[Store] Tasks count before update:', get().tasks.length)

    set((state) => ({
      tasks: state.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    }))

    const taskAfter = get().tasks.find(t => t.id === taskId)

    console.log('[Store] ✓ Task updated successfully')
    console.log('[Store] New status:', taskAfter.status)
    console.log('[Store] New priority:', taskAfter.priority)
    console.log('[Store] Tasks count after update:', get().tasks.length)
    console.log('[Store] Task still exists:', !!taskAfter)

    get().updateCurrentProject()
  },

  deleteTask: (taskId) => {
    const taskToDelete = get().tasks.find(t => t.id === taskId)

    console.log('[Store] ✗ DELETING TASK (Manual)')
    console.log('[Store] Task ID:', taskId)
    console.log('[Store] Task title:', taskToDelete?.title || 'Unknown')
    console.log('[Store] Tasks count before delete:', get().tasks.length)

    set((state) => ({
      tasks: state.tasks.filter(task => task.id !== taskId)
    }))

    console.log('[Store] Tasks count after delete:', get().tasks.length)
    console.log('[Store] ✓ Task deleted')

    get().updateCurrentProject()
  },

  moveTask: (taskId, newStatus) => {
    get().updateTask(taskId, { status: newStatus })
  },

  clearTasks: () => {
    set({ tasks: [] })
    get().updateCurrentProject()
  },

  // Summary Actions
  setSummary: (summary) => {
    set({ summary })
    get().updateCurrentProject()
  },

  // UI Actions
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  addNotification: (notification) => {
    const id = generateId()
    const newNotification = { id, ...notification, timestamp: Date.now() }
    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }))

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(id)
    }, 5000)

    return id
  },

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  // Clear current session
  clearSession: () => {
    localStorage.removeItem('lastSelectedProject')
    localStorage.removeItem('lastSelectedMeeting')
    console.log('[Store] Cleared project and meeting selection from localStorage')

    set({
      currentProject: null,
      tasks: [],
      meetings: [],
      selectedMeetingId: null,
      isRecording: false,
      recordingTime: 0,
      audioBlob: null
    })
  },

  // Update upload progress
  setUploadProgress: (progress) => {
    console.log('[Store] Upload progress:', progress.stage, progress.percentage ? `${progress.percentage}%` : '')
    set({ uploadProgress: { ...get().uploadProgress, ...progress } })
  },

  // Reset upload progress
  resetUploadProgress: () => set({
    uploadProgress: {
      stage: 'idle',
      percentage: 0,
      message: '',
      error: null
    }
  })
}))

export default useAppStore
