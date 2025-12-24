import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AudioControls from '../components/AudioControls'
import KanbanBoard from '../components/KanbanBoard'
import MeetingFilesPanel from '../components/MeetingFilesPanel'
import SummaryPanel from '../components/SummaryPanel'
import useAppStore from '../stores/useAppStore'

export default function ProjectView() {
  const { projectId, meetingId } = useParams()
  const navigate = useNavigate()
  const currentProject = useAppStore((state) => state.currentProject)
  const loadProject = useAppStore((state) => state.loadProject)
  const clearCurrentProject = useAppStore((state) => state.clearCurrentProject)
  const projects = useAppStore((state) => state.projects)
  const selectMeeting = useAppStore((state) => state.selectMeeting)
  const selectedMeetingId = useAppStore((state) => state.selectedMeetingId)
  const meetings = useAppStore((state) => state.meetings)

  // Sync URL to match selected meeting (state -> URL, not URL -> state)
  useEffect(() => {
    if (!projectId || !currentProject) {return}

    // Only update URL if it doesn't match current selection
    if (selectedMeetingId && meetingId !== selectedMeetingId) {
      navigate(`/project/${projectId}/meeting/${selectedMeetingId}`, { replace: true })
    } else if (!selectedMeetingId && meetingId) {
      navigate(`/project/${projectId}`, { replace: true })
    }
  }, [selectedMeetingId, projectId, meetingId, currentProject, navigate])

  useEffect(() => {
    // If project ID in URL doesn't match current project, load it
    // BUT only if we need to - don't reload if we're already on the right project
    if (projectId && currentProject?.id !== projectId) {
      const project = projects.find((p) => p.id === projectId)
      if (project) {
        loadProject(projectId)
      } else {
        // Project not found, redirect to dashboard
        navigate('/')
      }
    }
  }, [projectId, currentProject, projects, loadProject, navigate])

  useEffect(() => {
    // Sync URL meeting to state (URL -> state, only for direct navigation)
    // Don't do anything if state already matches URL
    if (meetingId && selectedMeetingId !== meetingId) {
      const meeting = meetings.find((m) => m.id === meetingId)
      if (meeting) {
        selectMeeting(meetingId)
      } else if (meetings.length > 0) {
        // Meeting not found and we have loaded meetings, redirect to project
        navigate(`/project/${projectId}`, { replace: true })
      }
      // If meetings.length === 0, we're still loading, so don't redirect
    } else if (!meetingId && selectedMeetingId) {
      // URL has no meeting but state does, clear selection
      selectMeeting(null)
    }
  }, [meetingId, selectedMeetingId, meetings, selectMeeting, navigate, projectId])

  // If no project loaded yet, show loading
  if (!currentProject || currentProject.id !== projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    )
  }

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
            onClick={() => {
              clearCurrentProject()
              navigate('/')
            }}
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
