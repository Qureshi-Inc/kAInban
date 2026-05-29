import { motion } from 'framer-motion'
import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import AudioControls from '../components/AudioControls'
import KanbanBoardKit from '../components/KanbanBoardKit'
import MeetingFilesPanel from '../components/MeetingFilesPanel'
import TasksView from '../components/shell/TasksView'
import ViewSwitcher from '../components/shell/ViewSwitcher'
import SummaryPanel from '../components/SummaryPanel'
import useViewMode from '../hooks/useViewMode'
import { getShortId } from '../lib/utils'
import useAppStore from '../stores/useAppStore'

export default function MainView() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const projectId = searchParams.get('project')
  const meetingId = searchParams.get('meeting')
  const taskId = searchParams.get('task')
  const filter = searchParams.get('filter')

  const currentProject = useAppStore(state => state.currentProject)
  const clearCurrentProject = useAppStore(state => state.clearCurrentProject)
  const selectMeeting = useAppStore(state => state.selectMeeting)
  const selectedMeetingId = useAppStore(state => state.selectedMeetingId)
  const meetings = useAppStore(state => state.meetings)
  const projects = useAppStore(state => state.projects)
  // v3.1.5 view switcher state — persists per workspace, defaults to
  // `list` for new users. The ViewSwitcher itself lives in the breadcrumb
  // bar below; this hook reads the same key the command palette writes.
  const [viewMode] = useViewMode()

  // Cross-project task pool for filter views (Inbox / Today). Pulled from
  // the projects array since each project's tasks are populated by
  // initialize(). We hydrate a `_projectName` on each task so the
  // filtered list can show which project it came from later (Slice 5).
  const allTasks = React.useMemo(() => {
    if (!projects || projects.length === 0) {
      return []
    }
    const out = []
    for (const p of projects) {
      if (!p.tasks || p.tasks.length === 0) {
        continue
      }
      for (const t of p.tasks) {
        out.push({ ...t, _projectId: p.id, _projectName: p.name })
      }
    }
    return out
  }, [projects])

  const todayYmd = React.useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const filteredTasks = React.useMemo(() => {
    if (filter === 'inbox') {
      // "Inbox" = AI-extracted tasks (meetingId set) that aren't done.
      // The AI's loading dock per DESIGN.md v3.1.2 / 3.1.9.
      return allTasks.filter(t => t.meetingId && t.status !== 'done')
    }
    if (filter === 'today') {
      // Tasks due today across all projects, excluding done.
      return allTasks.filter(t => t.dueDate === todayYmd && t.status !== 'done')
    }
    return null
  }, [filter, allTasks, todayYmd])

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
      console.log(
        '[MainView] URL sync - updating URL from',
        currentSearch,
        'to',
        newSearch,
        'for project',
        currentProject.name
      )
      navigate(newSearch, { replace: true })
    } else {
      console.log('[MainView] URL already matches project state')
    }
  }, [currentProject?.id, selectedMeetingId, navigate])

  // v3.1.4 — `?task=<id>` URL handoff. KanbanBoardKit has its own copy
  // for the legacy modal path, but in list mode the kanban isn't mounted
  // so route it here too. The store action no-ops if currentTaskId is
  // already set (and the inspector's own mount effect handles refresh).
  //
  // Bidirectional: when the URL drops `?task=` (browser back / forward,
  // or any caller that navigates without going through closeTaskInspector)
  // and the store still has a task open, close the inspector so the UI
  // matches the URL. Without this, pressing back leaves the inspector
  // visually stuck even though the address bar reverted.
  const tasks = useAppStore(state => state.tasks)
  const openTaskInspector = useAppStore(state => state.openTaskInspector)
  const closeTaskInspector = useAppStore(state => state.closeTaskInspector)
  const currentTaskId = useAppStore(state => state.currentTaskId)
  useEffect(() => {
    if (taskId) {
      if (currentTaskId === taskId || tasks.length === 0) {
        return
      }
      const found = tasks.find(t => t.id === taskId)
      if (found) {
        openTaskInspector(found.id)
      }
    } else if (currentTaskId) {
      closeTaskInspector()
    }
  }, [taskId, tasks, currentTaskId, openTaskInspector, closeTaskInspector])

  // Project loading is now handled by the store's initialize() function with URL context
  // This effect is only needed for URL synchronization after project is already loaded

  // Handle meeting selection - ONLY sync FROM URL if user navigated directly
  // Don't clear selection if URL doesn't have meeting param (URL might be updating)
  useEffect(() => {
    if (meetingId && meetings.length > 0) {
      // Find meeting by short ID (match beginning of full ID)
      const meeting = meetings.find(m => m.id.startsWith(meetingId))

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

  // Filter views — Inbox / Today — when the sidebar nav routed here.
  // Renders a cross-project TasksView with the filter applied. Same
  // TaskRow primitive, same inspector wiring on click.
  if (!projectId && filter && filteredTasks) {
    const meta =
      filter === 'inbox'
        ? {
            title: 'Inbox',
            sub: 'AI-extracted tasks across all projects',
            empty: 'No AI-extracted tasks waiting. Quiet inbox.'
          }
        : filter === 'today'
          ? {
              title: 'Today',
              sub: 'Due today across all projects',
              empty: 'Nothing due today. Take a break.'
            }
          : null
    if (meta) {
      return (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider font-emphasis"
          >
            <span className="text-foreground">{meta.title}</span>
            <span className="h-px w-6 bg-border" aria-hidden />
            <span>{meta.sub}</span>
            <span className="font-mono text-[10px] tabular-nums normal-case tracking-normal">
              {filteredTasks.length}
            </span>
          </motion.div>
          <TasksView tasks={filteredTasks} emptyMessage={meta.empty} />
        </div>
      )
    }
  }

  // Show dashboard if no project selected
  if (!projectId || !currentProject) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider font-emphasis"
        >
          <span className="text-foreground">Dashboard</span>
          <span className="h-px w-6 bg-border" aria-hidden />
          <span>Overview &amp; Analytics</span>
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
        {/* v3 breadcrumb — uppercase mono kicker, hairline divider, mono
            task count. v3.1 view bar (ViewSwitcher) sits on the right. */}
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider font-emphasis flex-wrap">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 p-0"
            onClick={() => {
              clearCurrentProject()
              const currentParams = new URLSearchParams(window.location.search)
              const tenant = currentParams.get('tenant')
              const dashboardUrl = tenant ? `/?tenant=${tenant}` : '/'
              navigate(dashboardUrl)
            }}
          >
            Dashboard
          </button>
          <span className="h-px w-6 bg-border" aria-hidden />
          <span className="text-foreground normal-case font-serif text-base tracking-normal">
            {currentProject.name}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums normal-case tracking-normal">
            {currentProject.tasks?.length || 0} tasks
          </span>
          <span className="flex-1" />
          <span className="normal-case tracking-normal">
            <ViewSwitcher />
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

        {/* Tasks vs Kanban — v3.1.5. Same dataset, two presentations.
            KanbanBoardKit also still handles the task=<id> URL handoff
            for inspector reopen (works in both modes via the store).
            Mounting only the active view keeps the keyboard handlers
            from fighting each other. */}
        {viewMode === 'list' ? (
          <TasksView />
        ) : (
          <KanbanBoardKit taskToOpen={taskId} />
        )}
      </motion.div>
    </div>
  )
}
