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

const TaskCard = ({
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
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
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
          <div className="flex items-center justify-center text-xs px-1.5 py-0.5 rounded border bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500">
            +{assigneesList.length - 2}
          </div>
        )}
      </div>
    )
  }

  const getPriorityColor = priority => {
    switch (priority) {
      case 'high':
        return 'border-red-400 bg-gradient-to-br from-red-50 to-red-100 text-red-900 shadow-red-100'
      case 'medium':
        return 'border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-900 shadow-amber-100'
      case 'low':
        return 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-900 shadow-emerald-100'
      default:
        return 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 shadow-gray-100'
    }
  }

  const getDragStyles = () => {
    if (isDragging) {
      return 'scale-105 rotate-3 shadow-2xl ring-2 ring-primary/50 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/60'
    }
    return ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group task-card interactive-element bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-1 sm:p-4 mb-3 shadow-lg hover:shadow-2xl cursor-pointer backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-gradient-to-br hover:from-gray-50/50 hover:to-white dark:hover:from-gray-700/50 dark:hover:to-gray-800 focus:ring-2 focus:ring-primary/50 focus:outline-none ${getDragStyles()}`}
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
        <h4 className="font-bold text-sm line-clamp-2 flex-1 pr-2 text-gray-900 dark:text-gray-100">
          {task.title}
        </h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all"
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
            className={`text-xs px-3 py-1.5 rounded-full border-2 font-bold ${getPriorityColor(task.priority)} w-fit shadow-md`}
          >
            {task.priority.toUpperCase()}
          </span>
          {task.dueDate && (
            <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-800">
              📅{' '}
              {(() => {
                // Parse as local date to avoid timezone issues
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
        <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

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
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
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

  const getDropZoneStyles = () => {
    if (isDragOver) {
      switch (status) {
        case 'todo':
          return 'ring-2 ring-slate-400/50 ring-offset-2 bg-gradient-to-b from-slate-50/80 to-slate-100/50 border-slate-400/60 transform scale-[1.02]'
        case 'in-progress':
          return 'ring-2 ring-blue-400/50 ring-offset-2 bg-gradient-to-b from-blue-50/80 to-blue-100/50 border-blue-400/60 transform scale-[1.02]'
        case 'done':
          return 'ring-2 ring-green-400/50 ring-offset-2 bg-gradient-to-b from-green-50/80 to-green-100/50 border-green-400/60 transform scale-[1.02]'
        case 'blocked':
          return 'ring-2 ring-red-400/50 ring-offset-2 bg-gradient-to-b from-red-50/80 to-red-100/50 border-red-400/60 transform scale-[1.02]'
        default:
          return 'ring-2 ring-primary/50 ring-offset-2 bg-gradient-to-b from-primary/5 to-primary/10 border-primary/60 transform scale-[1.02]'
      }
    }
    return ''
  }

  const getColumnStyle = () => {
    switch (status) {
      case 'todo':
        return 'border-t-4 border-t-slate-400 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-gray-800'
      case 'in-progress':
        return 'border-t-4 border-t-blue-500 bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800'
      case 'done':
        return 'border-t-4 border-t-green-500 bg-gradient-to-b from-green-50 to-white dark:from-green-900/20 dark:to-gray-800'
      case 'blocked':
        return 'border-t-4 border-t-red-500 bg-gradient-to-b from-red-50 to-white dark:from-red-900/20 dark:to-gray-800'
      default:
        return 'border-t-4 border-t-gray-400'
    }
  }

  return (
    <Card
      className={`kanban-column w-full min-w-0 min-h-[500px] transition-all duration-300 hover:shadow-xl ${getColumnStyle()} ${getDropZoneStyles()} ${isDragOver ? 'drag-over' : ''}`}
      data-status={status}
    >
      <CardHeader className="pb-4 sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm z-10 border-b border-gray-200/50 dark:border-gray-700/50">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="font-bold text-lg">{title}</span>
          <motion.span
            className="bg-gradient-to-r from-primary/20 to-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold shadow-sm ring-1 ring-primary/20"
            whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            {count}
          </motion.span>
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

  // Add CSS for drag and drop visual feedback
  React.useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      /* Enhanced task card styles */
      .task-card {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform, box-shadow, border-color;
        position: relative;
        isolation: isolate;
      }

      .task-card::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        padding: 2px;
        background: linear-gradient(145deg, transparent, rgba(59, 130, 246, 0.1), transparent);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: xor;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .task-card:hover::before {
        opacity: 1;
      }

      /* Dragging state styles */
      .task-card.dragging {
        z-index: 1000;
        pointer-events: none;
        position: relative;
      }

      .task-card.dragging::after {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: inherit;
        background: linear-gradient(145deg,
          rgba(59, 130, 246, 0.2),
          rgba(139, 92, 246, 0.2),
          rgba(59, 130, 246, 0.2)
        );
        animation: drag-glow 2s ease-in-out infinite;
        z-index: -1;
      }

      @keyframes drag-glow {
        0%, 100% {
          opacity: 0.6;
          filter: blur(8px);
        }
        50% {
          opacity: 1;
          filter: blur(12px);
        }
      }

      /* Column drop zone styles */
      .kanban-column {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: visible;
        min-width: 0; /* Override any implicit min-width */
        width: 100%; /* Ensure full width */
      }

      .kanban-column::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: inherit;
        background: linear-gradient(145deg, transparent 0%, var(--drop-glow, transparent) 50%, transparent 100%);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: -1;
        filter: blur(8px);
      }

      .kanban-column.drag-over::before {
        opacity: 1;
      }

      /* Column-specific drop glow colors */
      .kanban-column[data-status="todo"]::before {
        --drop-glow: rgba(100, 116, 139, 0.3);
      }

      .kanban-column[data-status="in-progress"]::before {
        --drop-glow: rgba(59, 130, 246, 0.3);
      }

      .kanban-column[data-status="done"]::before {
        --drop-glow: rgba(34, 197, 94, 0.3);
      }

      .kanban-column[data-status="blocked"]::before {
        --drop-glow: rgba(239, 68, 68, 0.3);
      }

      /* Empty drop zone styling */
      .empty-drop-zone {
        border: 2px dashed rgba(156, 163, 175, 0.4);
        border-radius: 12px;
        transition: all 0.3s ease;
        position: relative;
        background: linear-gradient(145deg,
          rgba(249, 250, 251, 0.5),
          rgba(243, 244, 246, 0.3)
        );
      }

      .empty-drop-zone.drag-over {
        border-color: rgba(59, 130, 246, 0.6);
        background: linear-gradient(145deg,
          rgba(59, 130, 246, 0.05),
          rgba(59, 130, 246, 0.02)
        );
        transform: scale(1.01);
      }

      .empty-drop-zone::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        background: linear-gradient(45deg,
          rgba(59, 130, 246, 0.1),
          transparent,
          rgba(59, 130, 246, 0.1)
        );
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: -1;
        filter: blur(4px);
      }

      .empty-drop-zone.drag-over::before {
        opacity: 1;
      }

      /* Smooth animations for all interactive elements */
      .task-card, .kanban-column, .empty-drop-zone {
        transform-origin: center;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }

      /* Dark mode enhancements */
      .dark .task-card::before {
        background: linear-gradient(145deg, transparent, rgba(59, 130, 246, 0.2), transparent);
      }

      .dark .empty-drop-zone {
        background: linear-gradient(145deg,
          rgba(17, 24, 39, 0.5),
          rgba(31, 41, 55, 0.3)
        );
        border-color: rgba(75, 85, 99, 0.4);
      }

      .dark .empty-drop-zone.drag-over {
        background: linear-gradient(145deg,
          rgba(59, 130, 246, 0.1),
          rgba(59, 130, 246, 0.05)
        );
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

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
          color: 'border-l-slate-400 bg-slate-50'
        }
      case 'in-progress':
        return {
          title: '⚡ In Progress',
          tasks: inProgressTasks,
          color: 'border-l-blue-500 bg-blue-50'
        }
      case 'blocked':
        return {
          title: '🚫 Blocked',
          tasks: blockedTasks,
          color: 'border-l-red-500 bg-red-50'
        }
      case 'done':
        return {
          title: '✅ Done',
          tasks: doneTasks,
          color: 'border-l-green-500 bg-green-50'
        }
      default:
        return {
          title: status,
          tasks: [],
          color: 'border-l-gray-400 bg-gray-50'
        }
    }
  }

  const ListView = () => (
    <div className="space-y-4">
      {['todo', 'in-progress', 'blocked', 'done'].map(status => {
        const { title, tasks: statusTasks, color } = getStatusInfo(status)
        const isExpanded = expandedSections[status]

        return (
          <Card key={status} className={`border-l-4 ${color} dark:bg-gray-800`}>
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                  <span className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
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
                      <p className="text-gray-500 italic py-4">
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
                            className="group flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors focus:ring-2 focus:ring-primary/50 focus:outline-none"
                            onClick={() => handleTaskClick(task)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleTaskClick(task)
                              }
                            }}
                            aria-label={`Open task: ${task.title}`}
                          >
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                              {task.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={e => {
                                e.stopPropagation()
                                handleTaskDelete(task.id)
                              }}
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 flex-shrink-0 ml-2"
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
        <Card className="border-2 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <motion.div
                  className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  <CheckSquare className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Task Board
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {tasks.length} total tasks
                  </div>
                </div>
              </CardTitle>

              <div className="flex items-center gap-2">
                {/* Add Task Button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={handleCreateTask}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Task</span>
                  </Button>
                </motion.div>

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
                          className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                        >
                          {/* View Toggle */}
                          <button
                            onClick={() => {
                              setViewMode(
                                viewMode === 'kanban' ? 'list' : 'kanban'
                              )
                              setIsMenuOpen(false)
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors border-b border-gray-200 dark:border-gray-700"
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
                              className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 transition-colors"
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
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 xl:gap-6 w-full">
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
