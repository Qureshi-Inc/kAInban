import { motion } from 'framer-motion'
import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import AudioControls from '../components/AudioControls'
import KanbanBoardKit from '../components/KanbanBoardKit'
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
  const clearCurrentProject = useAppStore((state) => state.clearCurrentProject)
  const selectMeeting = useAppStore((state) => state.selectMeeting)
  const selectedMeetingId = useAppStore((state) => state.selectedMeetingId)
  const meetings = useAppStore((state) => state.meetings)

  // Sync URL to reflect state changes (State -> URL, not URL -> State)
  // Only sync when project ID or meeting ID actually changes, not just object references
  useEffect(() => {
    // Only sync URL when we have a current project loaded
    // Initial URL context is handled by store's initialize() function
    if (!currentProject) {
      return
    }

    // Preserve existing parameters (like tenant) and update project/meeting
    const params = new URLSearchParams(window.location.search)
    const shortProjectId = getShortId(currentProject.id)
    params.set('project', shortProjectId) // Use short ID

    if (selectedMeetingId) {
      params.set('meeting', getShortId(selectedMeetingId)) // Use short ID
    } else {
      params.delete('meeting') // Remove if no meeting selected
    }

    const newSearch = `?${params.toString()}`
    const currentSearch = window.location.search

    if (currentSearch !== newSearch) {
      console.log('[MainView] URL sync - updating URL from', currentSearch, 'to', newSearch, 'for project', currentProject.name)
      navigate(newSearch, { replace: true })
    } else {
      console.log('[MainView] URL already matches project state')
    }
  }, [currentProject?.id, selectedMeetingId, navigate])

  // Project loading is now handled by the store's initialize() function with URL context
  // This effect is only needed for URL synchronization after project is already loaded

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
            onClick={() => {
              clearCurrentProject()
              // Preserve tenant parameter when navigating to dashboard
              const currentParams = new URLSearchParams(window.location.search)
              const tenant = currentParams.get('tenant')
              const dashboardUrl = tenant ? `/?tenant=${tenant}` : '/'
              navigate(dashboardUrl)
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

        <KanbanBoardKit taskToOpen={taskId} />
      </motion.div>
    </div>
  )
}
