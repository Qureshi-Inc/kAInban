import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import AudioControls from '../components/AudioControls'
import KanbanBoard from '../components/KanbanBoard'
import MeetingFilesPanel from '../components/MeetingFilesPanel'
import SummaryPanel from '../components/SummaryPanel'
import useAppStore from '../stores/useAppStore'

export default function MainView() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const projectId = searchParams.get('project')
  const meetingId = searchParams.get('meeting')

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
        navigate('/', { replace: true })
      }
      return
    }

    const params = new URLSearchParams()
    params.set('project', currentProject.id.slice(0, 8)) // Use short ID

    if (selectedMeetingId) {
      params.set('meeting', selectedMeetingId.slice(0, 8)) // Use short ID
    }

    const newSearch = `?${params.toString()}`
    if (window.location.search !== newSearch) {
      navigate(newSearch, { replace: true })
    }
  }, [currentProject, selectedMeetingId, navigate])

  // Handle project loading - ONLY load from backend if switching projects
  // Don't reload if already on the correct project (prevents overwriting fresh state)
  useEffect(() => {
    if (projectId) {
      // Find project by short ID (match beginning of full ID)
      const project = projects.find((p) => p.id.startsWith(projectId))

      if (project) {
        // ONLY load if currentProject is different
        // This prevents reloading and overwriting state when URL updates AFTER state changes
        if (currentProject?.id !== project.id) {
          loadProject(project.id)
        }
      } else {
        // Project not found, redirect to dashboard
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

        <KanbanBoard />
      </motion.div>
    </div>
  )
}
