import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import AudioControls from '../components/AudioControls'
import KanbanBoard from '../components/KanbanBoard'
import MeetingFilesPanel from '../components/MeetingFilesPanel'
import SummaryPanel from '../components/SummaryPanel'
import { getShortId } from '../lib/utils'
import useAppStore from '../stores/useAppStore'

export default function MainView() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const projectId = searchParams.get('project')
  const meetingId = searchParams.get('meeting')
  const taskId = searchParams.get('task')

  const currentProject = useAppStore((state) => state.currentProject)
  const loadProject = useAppStore((state) => state.loadProject)
  const clearSession = useAppStore((state) => state.clearSession)
  const projects = useAppStore((state) => state.projects)
  const selectMeeting = useAppStore((state) => state.selectMeeting)
  const selectedMeetingId = useAppStore((state) => state.selectedMeetingId)
  const meetings = useAppStore((state) => state.meetings)

  // Sync URL to reflect state changes (State -> URL, not URL -> State)
  useEffect(() => {
    // If no currentProject, navigate to dashboard (clear URL params)
    if (!currentProject) {
      if (window.location.search !== '') {
        console.log('[MainView] No current project, navigating to dashboard')
        navigate('/', { replace: true })
      }
      return
    }

    const params = new URLSearchParams()
    const shortProjectId = getShortId(currentProject.id)
    params.set('project', shortProjectId) // Use short ID

    if (selectedMeetingId) {
      params.set('meeting', getShortId(selectedMeetingId)) // Use short ID
    }

    const newSearch = `?${params.toString()}`
    const currentSearch = window.location.search

    if (currentSearch !== newSearch) {
      console.log('[MainView] URL sync - updating URL from', currentSearch, 'to', newSearch, 'for project', currentProject.name)
      navigate(newSearch, { replace: true })
    } else {
      console.log('[MainView] URL already matches project state')
    }
  }, [currentProject, selectedMeetingId, navigate])

  // Handle project loading - ONLY load from backend if switching projects
  // Don't reload if already on the correct project (prevents overwriting fresh state)
  useEffect(() => {
    if (projectId) {
      // Find project by short ID (match beginning of full ID)
      const project = projects.find((p) => p.id.startsWith(projectId))

      if (project) {
        // ONLY load if currentProject is different AND we need to fetch from backend
        // Skip loading if the project is already the current one (prevents loops)
        if (currentProject?.id !== project.id) {
          console.log('[MainView] Loading different project:', project.id, 'current:', currentProject?.id)
          loadProject(project.id)
        } else {
          console.log('[MainView] Project already loaded, skipping reload')
        }
      } else {
        // Project not found in local state, redirect to dashboard
        console.log('[MainView] Project not found:', projectId)
        navigate('/')
      }
    }
    // Don't clear session when no projectId - URL might just not be updated yet
  }, [projectId, currentProject, projects, loadProject, navigate])

  // Handle meeting selection - ONLY sync FROM URL if user navigated directly
  // Don't clear selection if URL doesn't have meeting param (URL might be updating)
  useEffect(() => {
    if (meetingId && meetings.length > 0) {
      // Find meeting by short ID (match beginning of full ID)
      const meeting = meetings.find((m) => m.id.startsWith(meetingId))

      if (meeting) {
        selectMeeting(meeting.id)
      } else {
        // Meeting not found, redirect to project without meeting
        const params = new URLSearchParams(searchParams)
        params.delete('meeting')
        navigate(`/?${params.toString()}`)
      }
    }
    // Don't clear selection when meetingId is empty - state drives selection
  }, [meetingId, meetings, selectMeeting, navigate, searchParams])

  // Show dashboard if no project selected
  if (!projectId || !currentProject) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <span className="font-medium">Dashboard</span>
          <span className="text-xs">•</span>
          <span>Overview & Analytics</span>
        </motion.div>
        <AnalyticsDashboard />
      </div>
    )
  }

  // Show loading if project doesn't match (compare using startsWith for short ID)
  if (!currentProject.id.startsWith(projectId)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    )
  }

  // Show project view
  return (
    <div className="space-y-8">
      {/* Project breadcrumb and context */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground cursor-pointer transition-colors font-medium bg-transparent border-0 p-0"
            onClick={() => navigate('/')}
          >
            Dashboard
          </button>
          <span className="text-xs">→</span>
          <span className="font-medium text-foreground">{currentProject.name}</span>
          <span className="text-xs">•</span>
          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
            {currentProject.tasks?.length || 0} tasks
          </span>
        </div>
      </motion.div>

      {/* Audio controls with modern styling */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <AudioControls />
      </motion.div>

      {/* Content grid with improved spacing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-8"
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8">
            <SummaryPanel />
          </div>

          <div className="xl:col-span-4">
            <MeetingFilesPanel />
          </div>
        </div>

        <KanbanBoard taskToOpen={taskId} />
      </motion.div>
    </div>
  )
}
