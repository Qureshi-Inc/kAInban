import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2,
  CheckSquare,
  Plus,
  MoreVertical,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  FileText,
  User,
  Sparkles
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getShortId } from '../lib/utils'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import TaskDetailModal from './TaskDetailModal'
import TaskGroupingModal from './TaskGroupingModal'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import '../styles/mobile-ux.css'
import './KanbanBoard.css'

// React.memo'd so a Column re-render (which builds a fresh `tasks` array on
// every parent render) doesn't force every TaskCard to re-render too. The
// default shallow compare on props is fine here - parents pass primitives
// (task object, callbacks, users array) and as long as those references are
// stable across renders, the card stays mounted as-is.
const TaskCard = React.memo(({
  task,
  onDelete,
  onClick,
  onNavigateToMeeting,
  users = []
}) => {
  const [isDragging, setIsDragging] = React.useState(false)
  const [isTouchDevice, setIsTouchDevice] = React.useState(false)
  const [touchStart, setTouchStart] = React.useState({ x: 0, y: 0, time: 0 })
  const [isScrolling, setIsScrolling] = React.useState(false)

  React.useEffect(() => {
    // Detect if this is a touch device
    setIsTouchDevice('ontouchstart' in window)
  }, [])

  // Check if assignee is a database user
  const isAssigneeDbUser = assigneeName => {
    if (!assigneeName || !users.length) {
      return false
    }
    return users.some(
      user =>
        user.name.toLowerCase() === assigneeName.toLowerCase() ||
        user.email.toLowerCase() === assigneeName.toLowerCase()
    )
  }

  const getAssigneesDisplay = task => {
    // Handle both new assignees array and legacy assignee string
    let assigneesList = []
    if (task.assignees && Array.isArray(task.assignees)) {
      assigneesList = task.assignees
    } else if (task.assignee) {
      assigneesList = [task.assignee]
    }

    if (assigneesList.length === 0) {
      return null
    }

    return (
      <div className="flex flex-wrap gap-1">
        {assigneesList.slice(0, 2).map((assigneeName, index) => {
          const isDbUser = isAssigneeDbUser(assigneeName)
          const user = users.find(
            u =>
              u.name.toLowerCase() === assigneeName.toLowerCase() ||
              u.email.toLowerCase() === assigneeName.toLowerCase()
          )

          return (
            <div
              key={assigneeName}
              className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
                isDbUser
                  ? 'bg-info/10 text-info border-info/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              <User className="h-2.5 w-2.5" />
              <span
                className="truncate max-w-16"
                title={user ? `${user.name} (${user.email})` : assigneeName}
              >
                {isDbUser && user ? user.name : assigneeName}
              </span>
              {isDbUser && (
                <div
                  className="w-1 h-1 bg-green-500 rounded-full"
                  title="Database User"
                />
              )}
            </div>
          )
        })}
        {assigneesList.length > 2 && (
          <div className="flex items-center justify-center text-xs px-1.5 py-0.5 rounded border bg-secondary text-muted-foreground border-border">
            +{assigneesList.length - 2}
          </div>
        )}
      </div>
    )
  }

  // Priority chip — soft semantic background, no gradients, no shadow glow.
  // See DESIGN.md → Components → Badge / chip.
  const getPriorityColor = priority => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/12 text-destructive border border-destructive/30'
      case 'medium':
        return 'bg-warning/12 text-warning border border-warning/30'
      case 'low':
        return 'bg-success/12 text-success border border-success/30'
      default:
        return 'bg-muted text-muted-foreground border border-border'
    }
  }

  // Drag styles — modest elevation only, no scale/rotate/glow halo.
  const getDragStyles = () => {
    if (isDragging) {
      return 'dragging opacity-90'
    }
    return ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group task-card interactive-element cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${getDragStyles()}`}
      style={{
        transformOrigin: 'center center',
        contain: 'layout style paint'
      }}
      data-task-id={task.id}
      draggable={!isTouchDevice}
      onDragStart={e => {
        if (isTouchDevice) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
      }}
      onDragEnd={() => {
        setIsDragging(false)
      }}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        if (!isDragging) {
          // Add small delay to prevent double-taps and ensure smooth interaction
          setTimeout(() => {
            onClick(task)
          }, 50)
        }
      }}
      onTouchStart={e => {
        // Record touch start position and time for scroll detection
        if (e.touches.length === 1) {
          setIsDragging(false)
          setIsScrolling(false)
          const touch = e.touches[0]
          setTouchStart({
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
          })
        }
      }}
      onTouchMove={e => {
        // Detect if this is a scroll gesture
        if (e.touches.length === 1 && touchStart.time > 0) {
          const touch = e.touches[0]
          const deltaX = Math.abs(touch.clientX - touchStart.x)
          const deltaY = Math.abs(touch.clientY - touchStart.y)

          // If finger moved more than 10px, consider it scrolling
          if (deltaX > 10 || deltaY > 10) {
            setIsScrolling(true)
          }
        }
      }}
      onTouchEnd={e => {
        // Only handle touch end if not scrolling and was a quick tap
        if (!isScrolling && touchStart.time > 0) {
          const touchDuration = Date.now() - touchStart.time

          // Only trigger onClick for quick taps (less than 300ms) that didn't move much
          if (touchDuration < 300 && e.touches.length === 0) {
            e.preventDefault()
            e.stopPropagation()
            setTimeout(() => {
              onClick(task)
            }, 50)
          }
        }

        // Reset touch tracking
        setTouchStart({ x: 0, y: 0, time: 0 })
        setIsScrolling(false)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(task)
        }
      }}
      aria-label={`Open task: ${task.title}`}
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-sm line-clamp-2 flex-1 pr-2 text-foreground">
          {task.title}
        </h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive dark:hover:bg-red-900/20 transition-all"
          onClick={e => {
            e.stopPropagation()
            onDelete(task.id)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-3 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex justify-between items-end gap-2">
        <div className="flex flex-col gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold tracking-wider ${getPriorityColor(task.priority)} w-fit`}
          >
            {task.priority.toUpperCase()}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-warning font-mono-tabular bg-warning/10 px-2 py-0.5 rounded-sm border border-warning/30">
              {(() => {
                const parts = task.dueDate.split('-')
                if (parts.length === 3) {
                  const date = new Date(parts[0], parts[1] - 1, parts[2])
                  return date.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                }
                return new Date(task.dueDate).toLocaleDateString()
              })()}
            </span>
          )}
          {getAssigneesDisplay(task)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono-tabular">
          {new Date(task.createdAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          })}
        </span>
      </div>
    </div>
  )
})
TaskCard.displayName = 'TaskCard'

const TaskSource = ({ meetingId, onNavigateToMeeting }) => {
  const meetings = useAppStore(state => state.meetings)

  if (!meetingId) {
    return null
  }

  const meeting = meetings.find(m => m.id === meetingId)
  if (!meeting) {
    return null
  }

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <button
        onClick={e => {
          e.stopPropagation()
          onNavigateToMeeting(meetingId)
        }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors group"
      >
        <FileText className="h-3 w-3 group-hover:scale-110 transition-transform" />
        <span className="group-hover:underline">From: {meeting.name}</span>
      </button>
    </div>
  )
}

const Column = ({
  title,
  status,
  tasks,
  onTaskMove,
  onTaskReorder,
  onTaskDelete,
  onTaskClick,
  onNavigateToMeeting,
  count,
  allTasks,
  users
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false)

  const handleDragOver = e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = e => {
    e.preventDefault()
    // Only remove hover state if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = e => {
    e.preventDefault()
    setIsDragOver(false)

    const taskId = e.dataTransfer.getData('text/plain')
    const task = allTasks.find(t => t.id === taskId)

    if (!task) {
      return
    }

    // If moving to a different column, just change status
    if (task.status !== status) {
      onTaskMove(taskId, status)
    } else {
      // Same column - handle reordering
      const dropTarget = e.target.closest('.task-card')
      if (
        dropTarget &&
        dropTarget !== e.target.closest(`[data-task-id="${taskId}"]`)
      ) {
        const targetTaskId = dropTarget.getAttribute('data-task-id')
        if (targetTaskId) {
          onTaskReorder(taskId, targetTaskId, status)
        }
      }
    }
  }

  // Drop zone styles — drag-over handled by .kanban-column.drag-over in CSS.
  // No per-status colored rings, no gradients, no scale transforms.
  const getDropZoneStyles = () => {
    return isDragOver ? 'drag-over' : ''
  }

  // Column accent — a single 2px top border in the status semantic color.
  // Replaces the per-column gradient backgrounds.
  const getColumnStyle = () => {
    switch (status) {
      case 'todo':
        return 'border-t-2 border-t-muted-foreground/40'
      case 'in-progress':
        return 'border-t-2 border-t-info'
      case 'done':
        return 'border-t-2 border-t-success'
      case 'blocked':
        return 'border-t-2 border-t-destructive'
      default:
        return 'border-t-2 border-t-border'
    }
  }

  return (
    <Card
      className={`kanban-column w-full min-w-0 min-h-[500px] ${getColumnStyle()} ${getDropZoneStyles()}`}
      data-status={status}
    >
      <CardHeader className="pb-3 sticky top-0 bg-card z-10 border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-emphasis uppercase tracking-wider text-foreground">
            {title}
          </span>
          <span className="text-xs font-mono-tabular text-muted-foreground">
            {String(count).padStart(2, '0')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent
        className="pt-0 transition-all duration-200"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-2 min-h-[400px] p-2">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onTaskMove}
              onDelete={onTaskDelete}
              onClick={onTaskClick}
              onNavigateToMeeting={onNavigateToMeeting}
              users={users}
            />
          ))}
          {tasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`empty-drop-zone flex flex-col items-center justify-center h-[400px] text-muted-foreground ${isDragOver ? 'drag-over' : ''}`}
            >
              <motion.div
                className="text-6xl mb-4 opacity-30"
                animate={{
                  scale: isDragOver ? 1.1 : 1,
                  opacity: isDragOver ? 0.6 : 0.3
                }}
                transition={{ duration: 0.2 }}
              >
                📋
              </motion.div>
              <motion.p
                className="text-sm italic font-medium"
                animate={{
                  opacity: isDragOver ? 0.8 : 0.7
                }}
              >
                {isDragOver ? 'Release to add task' : 'Drop tasks here'}
              </motion.p>
              <motion.p
                className="text-xs mt-1 opacity-50"
                animate={{
                  opacity: isDragOver ? 0.6 : 0.4
                }}
              >
                {isDragOver ? '✨ Perfect!' : 'Drag and drop to organize'}
              </motion.p>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function KanbanBoard({ taskToOpen }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    tasks,
    moveTask,
    updateTask,
    deleteTask,
    clearTasks,
    addNotification,
    addAiDiscoveredLinks,
    currentProject
  } = useAppStore()
  const [selectedTask, setSelectedTask] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' or 'list'
  const [users, setUsers] = useState([])
  const [isGroupingModalOpen, setIsGroupingModalOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    todo: true,
    'in-progress': true,
    blocked: true,
    done: true
  })
  const [hasRecentMerges, setHasRecentMerges] = useState(false)

  // Load users for assignee display
  useEffect(() => {
    const loadUsers = async() => {
      try {
        const usersData = await apiService.getUsers()
        setUsers(usersData || [])
      } catch (error) {
        console.warn('[KanbanBoard] Failed to load users:', error)
        setUsers([])
      }
    }
    loadUsers()
  }, [])

  // Check for recent merges to determine button visibility
  useEffect(() => {
    const checkRecentMerges = async() => {
      if (!currentProject?.id) {
        setHasRecentMerges(false)
        return
      }

      try {
        const recentMerges = await apiService.getRecentMerges(currentProject.id)
        setHasRecentMerges(recentMerges && recentMerges.length > 0)
      } catch (error) {
        console.warn('[KanbanBoard] Failed to check recent merges:', error)
        setHasRecentMerges(false)
      }
    }
    checkRecentMerges()
  }, [currentProject?.id, tasks]) // Re-check when project or tasks change

  // Handle opening specific task from URL
  React.useEffect(() => {
    if (taskToOpen && tasks.length > 0) {
      // Find task by exact ID match (taskToOpen is now full ID)
      const task = tasks.find(t => t.id === taskToOpen)
      if (task) {
        setSelectedTask(task)
        setIsModalOpen(true)
      }
    }
  }, [taskToOpen, tasks])

  // CSS for drag-and-drop visual feedback now lives in KanbanBoard.css
  // (imported above), not injected at runtime.

  const sortTasksByOrder = tasks => {
    return tasks.sort((a, b) => {
      // If both have order, sort by order
      if (a.order && b.order) {
        return a.order - b.order
      }
      // If only one has order, prioritize it
      if (a.order && !b.order) {
        return -1
      }
      if (!a.order && b.order) {
        return 1
      }
      // If neither has order, sort by creation time
      return new Date(a.createdAt) - new Date(b.createdAt)
    })
  }

  const todoTasks = sortTasksByOrder(
    tasks.filter(task => task.status === 'todo' || !task.status)
  )
  const inProgressTasks = sortTasksByOrder(
    tasks.filter(
      task => task.status === 'in-progress' || task.status === 'inprogress'
    )
  )
  const blockedTasks = sortTasksByOrder(
    tasks.filter(task => task.status === 'blocked' || task.status === 'on-hold')
  ) // Include legacy on-hold
  const doneTasks = sortTasksByOrder(
    tasks.filter(task => task.status === 'done')
  )

  const handleTaskReorder = (draggedTaskId, targetTaskId, status) => {
    // Get current tasks in this column
    const columnTasks = tasks.filter(t => t.status === status)
    const draggedIndex = columnTasks.findIndex(t => t.id === draggedTaskId)
    const targetIndex = columnTasks.findIndex(t => t.id === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) {
      return
    }

    // Create new order
    const reorderedTasks = [...columnTasks]
    const [draggedTask] = reorderedTasks.splice(draggedIndex, 1)
    reorderedTasks.splice(targetIndex, 0, draggedTask)

    // Update the order timestamps to preserve the new order
    const updatedTasks = reorderedTasks.map((task, index) => ({
      ...task,
      order: Date.now() + index // Use timestamp + index for ordering
    }))

    // Update all tasks in the store
    updatedTasks.forEach(task => {
      updateTask(task.id, { order: task.order })
    })
  }

  const handleTaskMove = async(taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) {
      return
    }

    const previousStatus = task.status

    // Move the task first
    moveTask(taskId, newStatus)

    // Only trigger completion logic if task is NEWLY completed (not already done)
    if (newStatus === 'done' && previousStatus !== 'done') {
      try {
        const relatedIndices = await openaiService.findRelatedTasks(
          tasks.filter(t => t.id !== taskId), // Exclude the completed task
          task.title,
          task.description
        )

        if (relatedIndices.length > 0) {
          const otherTasks = tasks.filter(t => t.id !== taskId)
          const relatedTaskIds = []

          relatedIndices.forEach(index => {
            if (index >= 0 && index < otherTasks.length) {
              const relatedTask = otherTasks[index]
              if (relatedTask.status !== 'done') {
                relatedTaskIds.push(relatedTask.id)
              }
            }
          })

          if (relatedTaskIds.length > 0) {
            // Add AI discovered links instead of immediately completing tasks
            addAiDiscoveredLinks(taskId, relatedTaskIds)

            addNotification({
              type: 'info',
              message: `Completed "${task.title}". AI found ${relatedTaskIds.length} related task${relatedTaskIds.length > 1 ? 's' : ''} - review in task details to accept or reject.`
            })
          }
        }
      } catch (error) {
        // Continue normally, don't block the user
      }
    }
  }

  const handleTaskDelete = taskId => {
    const task = tasks.find(t => t.id === taskId)
    if (task && confirm(`Delete task "${task.title}"?`)) {
      deleteTask(taskId)
      addNotification({
        type: 'success',
        message: 'Task deleted successfully'
      })
    }
  }

  const handleClearAll = () => {
    if (tasks.length === 0) {
      return
    }

    if (confirm('Clear all tasks? This cannot be undone.')) {
      clearTasks()
      addNotification({
        type: 'success',
        message: 'All tasks cleared'
      })
    }
  }

  const handleTaskClick = task => {
    setSelectedTask(task)
    setIsModalOpen(true)

    // Add full task ID to URL for bookmarking and sharing
    const newParams = new URLSearchParams(searchParams)
    newParams.set('task', task.id)
    navigate(`?${newParams.toString()}`, { replace: false })
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedTask(null)

    // Clear task parameter from URL if it exists
    if (searchParams.get('task')) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('task')
      navigate(`?${newParams.toString()}`, { replace: true })
    }
  }

  const handleNavigateToMeeting = meetingId => {
    const { selectMeeting } = useAppStore.getState()

    // Select the meeting in the store
    selectMeeting(meetingId)

    // Navigate to the project with the meeting parameter
    const projectId = searchParams.get('project')
    if (projectId) {
      const shortMeetingId = getShortId(meetingId)
      navigate(`/?project=${projectId}&meeting=${shortMeetingId}`)
    }
  }

  const handleCreateTask = () => {
    // Create a blank task for the user to fill in
    const newTask = {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium'
    }
    setSelectedTask(newTask)
    setIsModalOpen(true)
  }

  const toggleSection = status => {
    setExpandedSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  const getStatusInfo = status => {
    switch (status) {
      case 'todo':
        return {
          title: '📋 To Do',
          tasks: todoTasks,
          color: 'border-l-slate-400 bg-muted'
        }
      case 'in-progress':
        return {
          title: '⚡ In Progress',
          tasks: inProgressTasks,
          color: 'border-l-blue-500 bg-info/10'
        }
      case 'blocked':
        return {
          title: '🚫 Blocked',
          tasks: blockedTasks,
          color: 'border-l-red-500 bg-destructive/10'
        }
      case 'done':
        return {
          title: '✅ Done',
          tasks: doneTasks,
          color: 'border-l-green-500 bg-success/10'
        }
      default:
        return {
          title: status,
          tasks: [],
          color: 'border-l-gray-400 bg-muted'
        }
    }
  }

  const ListView = () => (
    <div className="space-y-4">
      {['todo', 'in-progress', 'blocked', 'done'].map(status => {
        const { title, tasks: statusTasks, color } = getStatusInfo(status)
        const isExpanded = expandedSections[status]

        return (
          <Card key={status} className={`border-l-4 ${color}`}>
            <CardHeader
              className="cursor-pointer hover:bg-secondary transition-colors"
              onClick={() => toggleSection(status)}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>{title}</span>
                  <span className="text-sm bg-secondary px-2 py-1 rounded-full">
                    {statusTasks.length}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pt-0">
                    {statusTasks.length === 0 ? (
                      <p className="text-muted-foreground italic py-4">
                        No tasks in this status
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {statusTasks.map(task => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            role="button"
                            tabIndex={0}
                            className="group flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded cursor-pointer transition-colors focus:ring-2 focus:ring-primary/50 focus:outline-none"
                            onClick={() => handleTaskClick(task)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleTaskClick(task)
                              }
                            }}
                            aria-label={`Open task: ${task.title}`}
                          >
                            <span className="text-sm font-medium text-foreground truncate flex-1">
                              {task.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={e => {
                                e.stopPropagation()
                                handleTaskDelete(task.id)
                              }}
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive flex-shrink-0 ml-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )
      })}
    </div>
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="border border-border bg-card">
          <CardHeader className="border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-md">
                  <CheckSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-emphasis tracking-tight text-foreground">
                    Task Board
                  </div>
                  <div className="text-xs text-muted-foreground font-mono-tabular">
                    {tasks.length} total tasks
                  </div>
                </div>
              </CardTitle>

              <div className="flex items-center gap-2">
                {/* Add Task Button */}
                <Button
                  onClick={handleCreateTask}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Task</span>
                </Button>

                {/* Menu Button */}
                <div className="relative">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </motion.div>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isMenuOpen && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          role="button"
                          tabIndex={0}
                          className="fixed inset-0 z-40"
                          onClick={() => setIsMenuOpen(false)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              setIsMenuOpen(false)
                            }
                          }}
                          aria-label="Close menu"
                        />

                        {/* Menu */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50"
                        >
                          {/* View Toggle */}
                          <button
                            onClick={() => {
                              setViewMode(
                                viewMode === 'kanban' ? 'list' : 'kanban'
                              )
                              setIsMenuOpen(false)
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-secondary flex items-center gap-2 transition-colors border-b border-border"
                          >
                            {viewMode === 'kanban' ? (
                              <>
                                <List className="h-4 w-4" />
                                Switch to List View
                              </>
                            ) : (
                              <>
                                <LayoutGrid className="h-4 w-4" />
                                Switch to Kanban View
                              </>
                            )}
                          </button>

                          {(tasks.length > 1 || hasRecentMerges) && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false)
                                setIsGroupingModalOpen(true)
                              }}
                              className="w-full px-4 py-3 text-left text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center gap-2 transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                              Group Similar Tasks
                            </button>
                          )}

                          {tasks.length > 0 && (
                            <button
                              onClick={() => {
                                setIsMenuOpen(false)
                                handleClearAll()
                              }}
                              className="w-full px-4 py-3 text-left text-sm hover:bg-destructive/10 dark:hover:bg-red-900/20 text-destructive flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Clear All Tasks
                            </button>
                          )}
                          {tasks.length === 0 && (
                            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                              No actions available
                            </div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {viewMode === 'kanban' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6 w-full overflow-x-auto">
                <Column
                  title="📋 To Do"
                  status="todo"
                  tasks={todoTasks}
                  count={todoTasks.length}
                  onTaskMove={handleTaskMove}
                  onTaskReorder={handleTaskReorder}
                  onTaskDelete={handleTaskDelete}
                  onTaskClick={handleTaskClick}
                  onNavigateToMeeting={handleNavigateToMeeting}
                  allTasks={tasks}
                  users={users}
                />
                <Column
                  title="⚡ In Progress"
                  status="in-progress"
                  tasks={inProgressTasks}
                  count={inProgressTasks.length}
                  onTaskMove={handleTaskMove}
                  onTaskReorder={handleTaskReorder}
                  onTaskDelete={handleTaskDelete}
                  onTaskClick={handleTaskClick}
                  onNavigateToMeeting={handleNavigateToMeeting}
                  allTasks={tasks}
                  users={users}
                />
                <Column
                  title="✅ Done"
                  status="done"
                  tasks={doneTasks}
                  count={doneTasks.length}
                  onTaskMove={handleTaskMove}
                  onTaskReorder={handleTaskReorder}
                  onTaskDelete={handleTaskDelete}
                  onTaskClick={handleTaskClick}
                  onNavigateToMeeting={handleNavigateToMeeting}
                  allTasks={tasks}
                  users={users}
                />
                <Column
                  title="🚫 Blocked"
                  status="blocked"
                  tasks={blockedTasks}
                  count={blockedTasks.length}
                  onTaskMove={handleTaskMove}
                  onTaskReorder={handleTaskReorder}
                  onTaskDelete={handleTaskDelete}
                  onTaskClick={handleTaskClick}
                  onNavigateToMeeting={handleNavigateToMeeting}
                  allTasks={tasks}
                  users={users}
                />
              </div>
            ) : (
              <ListView />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />

      {/* Task Grouping Modal */}
      <TaskGroupingModal
        open={isGroupingModalOpen}
        onOpenChange={setIsGroupingModalOpen}
      />
    </>
  )
}
