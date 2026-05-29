import { create } from 'zustand'
import { generateId } from '../lib/utils'
import apiService from '../services/apiService'

// Helper function to invalidate analytics cache when tasks change
const invalidateAnalyticsCache = async currentProject => {
  try {
    if (currentProject) {
      await apiService.clearAnalyticsInsights(currentProject.id)
    }
    // Also clear "all" cache since it aggregates all projects
    await apiService.clearAnalyticsInsights('all')
  } catch (error) {
    console.warn('[Store] Failed to invalidate analytics cache:', error)
  }
}

// Debounce helper to prevent concurrent project saves
let updateProjectTimeout = null
const debouncedUpdateCurrentProject = (projectData, callback) => {
  if (updateProjectTimeout) {
    clearTimeout(updateProjectTimeout)
  }
  updateProjectTimeout = setTimeout(async () => {
    try {
      await callback(projectData)
    } catch (error) {
      console.error('[Store] Debounced project save error:', error)
    }
    updateProjectTimeout = null
  }, 100) // 100ms debounce
}

const useAppStore = create((set, get) => ({
  // Authentication
  user: null,
  authChecked: false,

  // Settings
  settings: {
    provider: 'azure', // 'azure' | 'openai'
    // Shared
    apiKey: '',
    keyConfigured: false,
    // Azure-specific
    azureEndpoint: '',
    apiVersion: '2024-02-01',
    whisperDeployment: 'whisper-1', // Azure deployment name
    gptDeployment: 'gpt-4', // Azure deployment name
    // OpenAI-specific
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiWhisperModel: 'whisper-1',
    openaiGptModel: 'gpt-4o'
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
  // Activity panel (right-side slide-out from the existing ActivityPanel
  // component). Lifted into the store so the Sidebar's "Activity" nav
  // item can open it without prop-drilling through AppShell.
  isActivityPanelOpen: false,
  // Command palette (Cmd+K) — DESIGN.md v3.1.7. Global flag so the
  // CommandPalette primitive can render once at the App root and any
  // surface can request it open (currently: global keyboard listener +
  // the future TopBar palette-trigger button).
  isCommandPaletteOpen: false,
  // Task inspector — DESIGN.md v3.1.4. currentTaskId points at the task
  // being read/edited in the right-side inspector panel. Null = inspector
  // closed (AppShell hides the slot). Setting this navigates the URL
  // (?task=<id>) so the state survives reload + is shareable. The
  // openTaskInspector / closeTaskInspector actions own URL sync so call
  // sites don't have to repeat it.
  currentTaskId: null,
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
    try {
      const user = await apiService.getCurrentUser()
      set({ user, authChecked: true })
      return user
    } catch (error) {
      console.error('[Store] Auth check error:', error)
      // Make sure we always set authChecked to true even on error
      set({ user: null, authChecked: true })
      return null
    }
  },

  setUser: user => {
    set({ user })
  },

  logout: async () => {
    try {
      const result = await apiService.logout()
      // If the server returned an IdP end_session URL, navigate there FIRST
      // so the browser starts unloading immediately. Clearing zustand state
      // before the redirect causes a brief flash of AuthPage. The state will
      // be reset on the next page load anyway (no session = AuthPage).
      if (result && result.redirectUrl) {
        window.location.href = result.redirectUrl
        return
      }
      set({
        user: null,
        currentProject: null,
        projects: [],
        tasks: [],
        meetings: []
      })
    } catch (error) {
      console.error('[Store] Logout error:', error)
    }
  },

  // Initialize - Load data from backend
  initialize: async (urlContext = null) => {
    try {
      // Load settings
      const settings = await apiService.getSettings()
      if (settings) {
        set({ settings, settingsLoaded: true })
      } else {
        set({ settingsLoaded: true })
      }

      // Load projects
      const projects = await apiService.getAllProjects()

      // For each project, if it doesn't have tasks populated, try to load them
      const projectsWithTasks = await Promise.all(
        projects.map(async project => {
          // If the project already has tasks, use it as-is
          if (project.tasks && project.tasks.length > 0) {
            return project
          }
          // Otherwise, try to load the full project data including tasks
          try {
            const fullProject = await apiService.getProject(project.id)
            return fullProject || project
          } catch (error) {
            console.error(
              '[Store] Error loading project details for',
              project.id,
              error
            )
            return project
          }
        })
      )

      set({ projects: projectsWithTasks })

      // Handle project restoration with URL priority
      const currentState = get()

      // If URL context has project info, prioritize that over localStorage
      if (urlContext?.projectId) {
        console.log(
          '[Store] URL context provided, looking for project:',
          urlContext.projectId
        )
        const urlProject = projectsWithTasks.find(p =>
          p.id.startsWith(urlContext.projectId)
        )
        if (urlProject) {
          console.log(
            '[Store] Loading project from URL context:',
            urlProject.name
          )
          set({
            currentProject: urlProject,
            tasks: urlProject.tasks || [],
            meetings: urlProject.meetings || [],
            selectedMeetingId: null
          })
          return // Skip localStorage restoration
        }
      }

      // Restore last selected project from localStorage (only if no URL context)
      // BUT only if we don't already have a current project (prevents conflicts with project creation)
      const lastProjectId = localStorage.getItem('lastSelectedProject')
      const lastMeetingId = localStorage.getItem('lastSelectedMeeting')
      if (
        !currentState.currentProject && // Only restore if no project is currently selected
        !urlContext?.projectId && // Only if no URL project specified
        lastProjectId &&
        projectsWithTasks.some(p => p.id === lastProjectId)
      ) {
        // Use the already loaded project data
        const project = projectsWithTasks.find(p => p.id === lastProjectId)
        if (project) {
          // Check if the last selected meeting still exists in this project
          const meetingExists =
            project.meetings &&
            project.meetings.some(m => m.id === lastMeetingId)
          const selectedMeetingId = meetingExists ? lastMeetingId : null

          set({
            currentProject: project,
            tasks: project.tasks || [],
            meetings: project.meetings || [],
            selectedMeetingId: selectedMeetingId
          })
          if (selectedMeetingId) {
            // Meeting was selected, handle appropriately
          }
        }
      }
    } catch (error) {
      console.error('[Store] Initialization error:', error)
      console.error('[Store] Error stack:', error.stack)
      set({ settingsLoaded: true })
      throw error
    }
  },

  // Settings Actions
  updateSettings: async newSettings => {
    const settings = { ...get().settings, ...newSettings }
    set({ settings })

    // Save to backend
    await apiService.saveSettings(settings)
  },

  // Project Actions
  createProject: async name => {
    const project = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tasks: [],
      transcript: '',
      summary: ''
    }

    set(state => ({
      projects: [...state.projects, project],
      currentProject: project,
      tasks: [],
      meetings: [],
      selectedMeetingId: null
    }))

    // Save to localStorage for persistence
    localStorage.setItem('lastSelectedProject', project.id)

    // Save to backend
    await apiService.saveProject(project)

    return project
  },

  loadProject: async projectId => {
    console.log('[Store] Project ID:', projectId)

    const project = await apiService.getProject(projectId)

    if (project) {
      console.log('[Store] Project name:', project.name)
      console.log('[Store] Project tasks:', project.tasks)

      set(state => ({
        currentProject: project,
        tasks: project.tasks || [],
        meetings: project.meetings || [],
        selectedMeetingId: null,
        // Update the projects array with the loaded project data including tasks
        projects: state.projects.map(p =>
          p.id === projectId
            ? {
                ...project,
                lastModified: project.lastModified || new Date().toISOString()
              }
            : p
        )
      }))

      // Save to localStorage for persistence across refreshes
      localStorage.setItem('lastSelectedProject', projectId)
      // Clear last selected meeting when switching projects
      localStorage.removeItem('lastSelectedMeeting')
    } else {
      console.error('[Store] ✗ Project not found:', projectId)
    }
  },

  updateCurrentProject: () => {
    const { currentProject, tasks, meetings } = get()
    if (!currentProject) {
      console.warn('[Store] updateCurrentProject: No current project to update')
      return
    }

    // Log some task details to verify linked tasks are included
    const tasksWithLinks = tasks.filter(
      t => t.linkedTasks && t.linkedTasks.length > 0
    )
    if (tasksWithLinks.length > 0) {
      tasksWithLinks.forEach(task => {})
    }

    const updatedProject = {
      ...currentProject,
      tasks,
      meetings,
      lastModified: new Date().toISOString()
    }

    set(state => ({
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === currentProject.id ? updatedProject : p
      )
    }))

    // Use debounced save to prevent concurrent API calls
    debouncedUpdateCurrentProject(updatedProject, async projectData => {
      try {
        const success = await apiService.saveProject(projectData)
        if (success) {
          console.log('[Store] ✓ Project saved successfully (debounced)')
        } else {
          console.error(
            '[Store] ✗ Project update failed - apiService returned false'
          )
          throw new Error('API service returned false')
        }
      } catch (error) {
        console.error('[Store] ✗ Project update failed:', error)
        throw error
      }
    })
  },

  deleteProject: async projectId => {
    const wasCurrentProject = get().currentProject?.id === projectId

    try {
      // Delete from backend first
      const success = await apiService.deleteProject(projectId)

      if (!success) {
        throw new Error('Failed to delete project from server')
      }

      // Only update local state if backend deletion succeeded
      set(state => ({
        projects: state.projects.filter(p => p.id !== projectId),
        currentProject:
          state.currentProject?.id === projectId ? null : state.currentProject,
        tasks: state.currentProject?.id === projectId ? [] : state.tasks,
        meetings: state.currentProject?.id === projectId ? [] : state.meetings,
        selectedMeetingId:
          state.currentProject?.id === projectId
            ? null
            : state.selectedMeetingId
      }))

      // Clear localStorage if this was the current project
      if (wasCurrentProject) {
        localStorage.removeItem('lastSelectedProject')
      }

      return true
    } catch (error) {
      console.error('[Store] Delete project failed:', error)
      throw error
    }
  },

  deleteAllProjects: async () => {
    try {
      // Delete all projects from backend in one call
      await apiService.deleteAllProjects()

      // Clear all local state
      set({
        projects: [],
        currentProject: null,
        tasks: [],
        meetings: [],
        selectedMeetingId: null
      })

      // Clear localStorage
      localStorage.removeItem('lastSelectedProject')
      localStorage.removeItem('lastSelectedMeeting')

      console.log('[Store] All projects deleted successfully')
      return true
    } catch (error) {
      console.error('[Store] Delete all projects error:', error)
      throw error
    }
  },

  // Clear current project (for navigation)
  clearCurrentProject: () => {
    set({
      currentProject: null,
      tasks: [],
      meetings: [],
      selectedMeetingId: null
    })

    // Clear localStorage to prevent auto-reloading
    localStorage.removeItem('lastSelectedProject')
  },

  // Recording Actions
  setRecording: isRecording => set({ isRecording }),
  setPaused: isPaused => set({ isPaused }),
  setRecordingTime: time => set({ recordingTime: time }),
  setRecordingModalOpen: open => set({ isRecordingModalOpen: open }),

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
    } catch (error) {
      console.error('[Store] Failed to save meeting to backend:', error)
      // Continue with local storage for now
    }

    set(state => ({
      meetings: [...state.meetings, meeting],
      selectedMeetingId: meeting.id
    }))

    get().updateCurrentProject()
    return meeting
  },

  selectMeeting: meetingId => {
    set({ selectedMeetingId: meetingId })

    // Save to localStorage for persistence across refreshes
    if (meetingId) {
      localStorage.setItem('lastSelectedMeeting', meetingId)
    } else {
      localStorage.removeItem('lastSelectedMeeting')
    }
  },

  deleteMeeting: async meetingId => {
    const wasSelected = get().selectedMeetingId === meetingId

    try {
      // Delete from backend
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete meeting from backend')
      }
    } catch (error) {
      console.error('[Store] Failed to delete meeting from backend:', error)
      // Continue with local deletion even if backend fails
    }

    set(state => ({
      meetings: state.meetings.filter(m => m.id !== meetingId),
      selectedMeetingId: wasSelected ? null : state.selectedMeetingId
    }))

    // Clear from localStorage if this was the selected meeting
    if (wasSelected) {
      localStorage.removeItem('lastSelectedMeeting')
    }

    get().updateCurrentProject()
  },

  getSelectedMeeting: () => {
    const { meetings, selectedMeetingId } = get()
    return meetings.find(m => m.id === selectedMeetingId) || null
  },

  // Task Actions
  addTask: task => {
    const newTask = {
      id: generateId(),
      title: task.title || 'Untitled Task',
      description: task.description || '',
      priority: task.priority || 'medium',
      subtasks: task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [],
      comments: task.comments || [],
      status: 'todo',
      createdAt: new Date().toISOString(),
      dueDate: task.dueDate || null,
      projectId: get().currentProject?.id || null,
      meetingId: task.meetingId || null, // Source meeting reference
      linkedTasks: task.linkedTasks || [], // Manual user-created links - auto-complete
      aiCreatedLinks: task.aiCreatedLinks || [], // AI links from transcript analysis - need user review
      aiDiscoveredLinks: task.aiDiscoveredLinks || [], // AI links from completion - need user review
      rejectedAiLinks: task.rejectedAiLinks || [], // User rejected AI suggestions
      ...task
    }

    console.log('[Store] Task ID:', newTask.id)
    console.log('[Store] Status:', newTask.status)
    console.log('[Store] Tasks before add:', get().tasks.length)

    set(state => ({ tasks: [...state.tasks, newTask] }))

    // Invalidate analytics cache since task count changed
    invalidateAnalyticsCache(get().currentProject)

    get().updateCurrentProject()
    return newTask
  },

  // Batch add multiple tasks without saving after each one
  addTasks: tasks => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return []
    }

    const newTasks = tasks.map(task => ({
      id: task.id || generateId(),
      title: task.title || 'Untitled Task',
      description: task.description || '',
      priority: task.priority || 'medium',
      subtasks: task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [],
      comments: task.comments || [],
      status: task.status || 'todo',
      createdAt: new Date().toISOString(),
      dueDate: task.dueDate || null,
      projectId: get().currentProject?.id || null,
      meetingId: task.meetingId || null,
      linkedTasks: task.linkedTasks || [],
      aiCreatedLinks: task.aiCreatedLinks || [],
      aiDiscoveredLinks: task.aiDiscoveredLinks || [],
      rejectedAiLinks: task.rejectedAiLinks || [],
      ...task
    }))

    console.log('[Store] Batch adding tasks:', newTasks.length)

    set(state => ({ tasks: [...state.tasks, ...newTasks] }))

    // Invalidate analytics cache since task count changed
    invalidateAnalyticsCache(get().currentProject)

    // Save once after all tasks are added
    get().updateCurrentProject()
    return newTasks
  },

  // Alias for consistency with naming convention
  createTask: task => {
    return get().addTask(task)
  },

  updateTask: (taskId, updates) => {
    const taskBefore = get().tasks.find(t => t.id === taskId)

    if (!taskBefore) {
      console.error('[Store] ✗ UPDATE FAILED: Task not found:', taskId)
      return
    }

    console.log('[Store] Task ID:', taskId)
    console.log('[Store] New updates:', updates)

    set(state => ({
      tasks: state.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    }))

    const taskAfter = get().tasks.find(t => t.id === taskId)

    console.log('[Store] New priority:', taskAfter.priority)
    console.log('[Store] Task still exists:', !!taskAfter)

    // Handle linked task status synchronization
    if (
      updates.status &&
      updates.status === 'done' &&
      taskBefore.linkedTasks &&
      taskBefore.linkedTasks.length > 0
    ) {
      taskBefore.linkedTasks.forEach(linkedTaskId => {
        const linkedTask = get().tasks.find(t => t.id === linkedTaskId)
        if (linkedTask && linkedTask.status !== 'done') {
          // Use setTimeout to avoid infinite recursion and allow the current update to complete
          setTimeout(() => {
            get().updateTask(linkedTaskId, { status: 'done' })
          }, 0)
        }
      })
    }

    // Invalidate analytics cache since task was updated
    invalidateAnalyticsCache(get().currentProject)

    get().updateCurrentProject()
  },

  deleteTask: async taskId => {
    // Persist the delete to the backend FIRST, then mutate local state on
    // success. Previously this only filtered the local tasks array and let
    // the debounced updateCurrentProject() pick up the removal via a full
    // project-save diff — that 100ms setTimeout could be canceled by a tab
    // close, a subsequent action, or fail silently in saveProject, leaving
    // a "deleted" task that reappeared on the next page refresh.
    const taskToDelete = get().tasks.find(t => t.id === taskId)
    if (!taskToDelete) {
      console.warn('[Store] deleteTask: task not found in local state:', taskId)
      return false
    }

    console.log('[Store] Task title:', taskToDelete.title || 'Unknown')

    try {
      const success = await apiService.deleteTask(taskId)
      if (!success) {
        throw new Error('Failed to delete task from server')
      }

      // Backend delete succeeded — now drop it from local state and the
      // current project's tasks array. Skip the debounced project save:
      // the row is already gone server-side, and re-POSTing the full
      // project would just record redundant change events.
      set(state => {
        const newTasks = state.tasks.filter(task => task.id !== taskId)
        const newProjects = state.currentProject
          ? state.projects.map(p =>
              p.id === state.currentProject.id
                ? {
                    ...p,
                    tasks: newTasks,
                    lastModified: new Date().toISOString()
                  }
                : p
            )
          : state.projects
        return {
          tasks: newTasks,
          currentProject: state.currentProject
            ? {
                ...state.currentProject,
                tasks: newTasks,
                lastModified: new Date().toISOString()
              }
            : state.currentProject,
          projects: newProjects
        }
      })

      // Invalidate analytics cache since task was deleted
      invalidateAnalyticsCache(get().currentProject)

      return true
    } catch (error) {
      console.error('[Store] Delete task failed:', error)
      throw error
    }
  },

  moveTask: (taskId, newStatus) => {
    get().updateTask(taskId, { status: newStatus })
  },

  clearTasks: () => {
    set({ tasks: [] })
    get().updateCurrentProject()
  },

  // Linked Tasks Actions
  linkTasks: (taskId, linkedTaskIds) => {
    // Update the main task with linked task IDs
    get().updateTask(taskId, { linkedTasks: linkedTaskIds })

    // Also update each linked task to include this task in their linkedTasks array
    linkedTaskIds.forEach(linkedTaskId => {
      const linkedTask = get().tasks.find(t => t.id === linkedTaskId)
      if (linkedTask) {
        const updatedLinkedTasks = [...(linkedTask.linkedTasks || []), taskId]
        // Remove duplicates
        const uniqueLinkedTasks = [...new Set(updatedLinkedTasks)]
        get().updateTask(linkedTaskId, { linkedTasks: uniqueLinkedTasks })
      }
    })
  },

  unlinkTasks: (taskId, taskToUnlinkId) => {
    // Remove the link from the main task
    const mainTask = get().tasks.find(t => t.id === taskId)
    if (mainTask && mainTask.linkedTasks) {
      const updatedLinkedTasks = mainTask.linkedTasks.filter(
        id => id !== taskToUnlinkId
      )
      get().updateTask(taskId, { linkedTasks: updatedLinkedTasks })
    }

    // Remove the reverse link from the other task
    const otherTask = get().tasks.find(t => t.id === taskToUnlinkId)
    if (otherTask && otherTask.linkedTasks) {
      const updatedLinkedTasks = otherTask.linkedTasks.filter(
        id => id !== taskId
      )
      get().updateTask(taskToUnlinkId, { linkedTasks: updatedLinkedTasks })
    }
  },

  getLinkedTasks: taskId => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task || !task.linkedTasks) {
      return []
    }

    return get().tasks.filter(t => task.linkedTasks.includes(t.id))
  },

  // AI Link Management
  acceptAiSuggestion: (taskId, suggestionId, suggestionType) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) {
      return
    }

    // Move AI suggestion to manual links
    const updatedLinkedTasks = [...(task.linkedTasks || []), suggestionId]
    const uniqueLinkedTasks = [...new Set(updatedLinkedTasks)]

    // Remove from AI suggestions
    let updatedAiCreatedLinks = task.aiCreatedLinks || []
    let updatedAiDiscoveredLinks = task.aiDiscoveredLinks || []

    if (suggestionType === 'created') {
      updatedAiCreatedLinks = updatedAiCreatedLinks.filter(
        id => id !== suggestionId
      )
    } else if (suggestionType === 'discovered') {
      updatedAiDiscoveredLinks = updatedAiDiscoveredLinks.filter(
        id => id !== suggestionId
      )
    }

    get().updateTask(taskId, {
      linkedTasks: uniqueLinkedTasks,
      aiCreatedLinks: updatedAiCreatedLinks,
      aiDiscoveredLinks: updatedAiDiscoveredLinks
    })
  },

  rejectAiSuggestion: (taskId, suggestionId, suggestionType) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) {
      return
    }

    // Add to rejected list
    const updatedRejectedAiLinks = [
      ...(task.rejectedAiLinks || []),
      suggestionId
    ]
    const uniqueRejectedLinks = [...new Set(updatedRejectedAiLinks)]

    // Remove from AI suggestions
    let updatedAiCreatedLinks = task.aiCreatedLinks || []
    let updatedAiDiscoveredLinks = task.aiDiscoveredLinks || []

    if (suggestionType === 'created') {
      updatedAiCreatedLinks = updatedAiCreatedLinks.filter(
        id => id !== suggestionId
      )
    } else if (suggestionType === 'discovered') {
      updatedAiDiscoveredLinks = updatedAiDiscoveredLinks.filter(
        id => id !== suggestionId
      )
    }

    get().updateTask(taskId, {
      aiCreatedLinks: updatedAiCreatedLinks,
      aiDiscoveredLinks: updatedAiDiscoveredLinks,
      rejectedAiLinks: uniqueRejectedLinks
    })
  },

  // Add AI discovered links (called from KanbanBoard when task completed)
  addAiDiscoveredLinks: (taskId, discoveredTaskIds) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task || !discoveredTaskIds.length) {
      return
    }

    // Filter out already linked or rejected suggestions
    const newDiscoveredLinks = discoveredTaskIds.filter(
      id =>
        !task.linkedTasks.includes(id) &&
        !task.aiCreatedLinks.includes(id) &&
        !task.aiDiscoveredLinks.includes(id) &&
        !task.rejectedAiLinks.includes(id)
    )

    if (newDiscoveredLinks.length > 0) {
      const updatedAiDiscoveredLinks = [
        ...(task.aiDiscoveredLinks || []),
        ...newDiscoveredLinks
      ]
      get().updateTask(taskId, { aiDiscoveredLinks: updatedAiDiscoveredLinks })
    }
  },

  // Summary Actions
  setSummary: summary => {
    set({ summary })
    get().updateCurrentProject()
  },

  // UI Actions
  setSettingsOpen: open => set({ isSettingsOpen: open }),
  setActivityPanelOpen: open => set({ isActivityPanelOpen: open }),

  setCommandPaletteOpen: open => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set(state => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

  /*
   * Task inspector (DESIGN.md v3.1.4). Owns URL sync so any caller can
   * open/close without duplicating the `?task=<id>` dance. Pass the
   * full task id (not the short id) — the URL stores the full id today.
   * Closing clears the URL param so a refresh after Esc doesn't reopen
   * the inspector you just dismissed.
   *
   * Note on the synthetic popstate dispatch: raw history.pushState /
   * replaceState do NOT notify React Router. React Router's history
   * listener only fires on real popstate (back/forward), so without the
   * synthetic dispatch:
   *   - useSearchParams() stays stale after open
   *   - the URL→store sync useEffect in MainView/KanbanBoardKit never
   *     fires when the browser back button later drops `?task=`
   *   - the inspector visually "won't close on back"
   * Dispatching popstate makes React Router re-read window.location and
   * keeps every URL-driven hook in sync. Idempotent: no-ops if the URL
   * already matches.
   */
  openTaskInspector: taskId => {
    if (!taskId) {
      return
    }
    set({ currentTaskId: taskId })
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('task') !== taskId) {
        params.set('task', taskId)
        window.history.pushState({}, '', `?${params.toString()}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch (_e) {
      // window unavailable (SSR / tests) — silent.
    }
  },
  closeTaskInspector: () => {
    set({ currentTaskId: null })
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.has('task')) {
        params.delete('task')
        const qs = params.toString()
        window.history.replaceState(
          {},
          '',
          qs ? `?${qs}` : window.location.pathname
        )
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch (_e) {
      // window unavailable — silent.
    }
  },

  addNotification: notification => {
    const id = generateId()
    const newNotification = { id, ...notification, timestamp: Date.now() }
    set(state => ({
      notifications: [...state.notifications, newNotification]
    }))

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(id)
    }, 5000)

    return id
  },

  removeNotification: id =>
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    })),

  // Clear current session
  clearSession: () => {
    localStorage.removeItem('lastSelectedProject')
    localStorage.removeItem('lastSelectedMeeting')

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
  setUploadProgress: progress => {
    console.log(
      '[Store] Upload progress:',
      progress.stage,
      progress.percentage ? `${progress.percentage}%` : ''
    )
    set({ uploadProgress: { ...get().uploadProgress, ...progress } })
  },

  // Reset upload progress
  resetUploadProgress: () =>
    set({
      uploadProgress: {
        stage: 'idle',
        percentage: 0,
        message: '',
        error: null
      }
    })
}))

export default useAppStore
