import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2,
  CheckSquare,
  Plus,
  MoreVertical,
  List,
  LayoutGrid,
  User,
  Sparkles
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getShortId } from '../lib/utils'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import SimpleListView from './SimpleListView'
import TaskDetailModal from './TaskDetailModal'
import TaskGroupingModal from './TaskGroupingModal'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import '../styles/mobile-ux.css'

const TaskCard = ({ task, onDelete, onClick, users = [] }) => {
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
        {assigneesList.slice(0, 2).map(assigneeName => {
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

  // Soft semantic chip — see DESIGN.md → Components → Badge / chip.
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

  return (
    <div
      className="group task-card cursor-pointer"
      onClick={() => onClick(task)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(task)
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        display: 'block !important',
        position: 'relative',
        minHeight: '120px',
        width: '100%',
        height: 'auto',
        visibility: 'visible !important',
        opacity: 1,
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        WebkitAppearance: 'none',
        isolation: 'isolate'
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <h4
          className="font-bold text-sm flex-1 pr-2 text-foreground"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.4em',
            maxHeight: '2.8em'
          }}
        >
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
        <p
          className="text-xs text-muted-foreground mb-3 leading-relaxed"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.4em',
            maxHeight: '4.2em'
          }}
        >
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
}

export default function KanbanBoardKit({ taskToOpen }) {
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
  const [viewMode, setViewMode] = useState('kanban')
  const [users, setUsers] = useState([])
  const [isGroupingModalOpen, setIsGroupingModalOpen] = useState(false)
  const [hasRecentMerges, setHasRecentMerges] = useState(false)

  // Scroll bounce animation for mobile discoverability
  const kanbanScrollRef = useRef(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Load users for assignee display
  useEffect(() => {
    const loadUsers = async() => {
      try {
        const usersData = await apiService.getUsers()
        setUsers(usersData || [])
      } catch (error) {
        console.warn('[KanbanBoardKit] Failed to load users:', error)
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
        console.warn('[KanbanBoardKit] Failed to check recent merges:', error)
        setHasRecentMerges(false)
      }
    }
    checkRecentMerges()
  }, [currentProject?.id, tasks])

  // Handle opening specific task from URL — route to inspector (v3.1.4).
  useEffect(() => {
    if (taskToOpen && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskToOpen)
      if (task) {
        const { openTaskInspector } = useAppStore.getState()
        openTaskInspector(task.id)
      }
    }
  }, [taskToOpen, tasks])

  // Scroll bounce animation when kanban comes into view on mobile
  useEffect(() => {
    if (viewMode !== 'kanban' || hasAnimated || !kanbanScrollRef.current) {
      return
    }

    // Only animate on mobile devices
    const isMobile = window.innerWidth <= 768
    if (!isMobile) {
      return
    }

    const container = kanbanScrollRef.current

    // Create intersection observer to detect when kanban comes into view
    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries
        if (entry.isIntersecting && !hasAnimated) {
          // Kanban is now visible, trigger bounce animation
          setTimeout(() => {
            // Perform 2-bounce animation sequence with fluid bouncy timing
            // Bounce 1 - Quick and snappy
            container.scrollTo({ left: 140, behavior: 'smooth' })

            setTimeout(() => {
              container.scrollTo({ left: 0, behavior: 'smooth' })

              // Bounce 2 - Slightly less distance, more gentle
              setTimeout(() => {
                container.scrollTo({ left: 100, behavior: 'smooth' })

                setTimeout(() => {
                  container.scrollTo({ left: 0, behavior: 'smooth' })
                  setHasAnimated(true)
                }, 450) // Faster return for bouncy feel
              }, 350) // Shorter gap for fluid motion
            }, 450) // Quicker return on first bounce
          }, 200) // Faster entry for immediate attention
        }
      },
      {
        threshold: 0.5, // Trigger when 50% of kanban is visible
        rootMargin: '0px 0px -10% 0px' // Trigger slightly before fully in view
      }
    )

    observer.observe(container)

    // Cleanup observer on unmount
    return () => {
      observer.disconnect()
    }
  }, [viewMode, hasAnimated]) // Remove tasks.length dependency since we want this based on viewport visibility

  const sortTasksByOrder = tasks => {
    return tasks.sort((a, b) => {
      if (a.order && b.order) {
        return a.order - b.order
      }
      if (a.order && !b.order) {
        return -1
      }
      if (!a.order && b.order) {
        return 1
      }
      return new Date(a.createdAt) - new Date(b.createdAt)
    })
  }

  // Prepare data for hello-pangea/dnd
  const getTasksByStatus = status => {
    let filteredTasks = []
    switch (status) {
      case 'todo':
        filteredTasks = tasks.filter(
          task => task.status === 'todo' || !task.status
        )
        break
      case 'in-progress':
        filteredTasks = tasks.filter(
          task => task.status === 'in-progress' || task.status === 'inprogress'
        )
        break
      case 'done':
        filteredTasks = tasks.filter(task => task.status === 'done')
        break
      case 'blocked':
        filteredTasks = tasks.filter(
          task => task.status === 'blocked' || task.status === 'on-hold'
        )
        break
      default:
        return []
    }
    return sortTasksByOrder(filteredTasks)
  }

  const columns = [
    { id: 'todo', title: '📋 To Do', tasks: getTasksByStatus('todo') },
    {
      id: 'in-progress',
      title: '⚡ In Progress',
      tasks: getTasksByStatus('in-progress')
    },
    { id: 'done', title: '✅ Done', tasks: getTasksByStatus('done') },
    { id: 'blocked', title: '🚫 Blocked', tasks: getTasksByStatus('blocked') }
  ]

  const handleTaskMove = async(taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) {
      return
    }

    const previousStatus = task.status
    moveTask(taskId, newStatus)

    // Only trigger completion logic if task is NEWLY completed
    if (newStatus === 'done' && previousStatus !== 'done') {
      try {
        const relatedIndices = await openaiService.findRelatedTasks(
          tasks.filter(t => t.id !== taskId),
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
            addAiDiscoveredLinks(taskId, relatedTaskIds)
            addNotification({
              type: 'info',
              message: `Completed "${task.title}". AI found ${relatedTaskIds.length} related task${relatedTaskIds.length > 1 ? 's' : ''} - review in task details to accept or reject.`
            })
          }
        }
      } catch (error) {
        // Continue normally
      }
    }
  }

  const onDragEnd = result => {
    const { destination, source, draggableId } = result

    // Dropped outside the list
    if (!destination) {
      return
    }

    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const taskId = draggableId
    const sourceColumnId = source.droppableId
    const destinationColumnId = destination.droppableId
    const destinationIndex = destination.index

    // Drag end: moving between columns or reordering within same column

    // Find the task
    const task = tasks.find(t => t.id === taskId)
    if (!task) {
      return
    }

    // If moving between columns, use the simple moveTask
    if (destinationColumnId !== sourceColumnId) {
      moveTask(taskId, destinationColumnId)

      // Handle AI completion logic if moving to done
      if (destinationColumnId === 'done' && task.status !== 'done') {
        handleTaskMove(taskId, destinationColumnId)
      }
      return
    }

    // If reordering within same column, calculate order
    console.log(
      `[Vertical Reorder] Reordering task ${taskId} within column ${destinationColumnId} to index ${destinationIndex}`
    )

    // Get tasks in the destination column (excluding dragged task)
    const destinationTasks = getTasksByStatus(destinationColumnId).filter(
      t => t.id !== taskId
    )
    console.log(
      '[Vertical Reorder] Destination tasks:',
      destinationTasks.map(t => ({ id: t.id, title: t.title, order: t.order }))
    )

    // Calculate new order based on destination index
    let newOrder = 1000 // default

    if (destinationTasks.length === 0) {
      // Only task in column
      newOrder = 1000
    } else if (destinationIndex === 0) {
      // Moving to top
      const firstTask = destinationTasks[0]
      newOrder = (firstTask.order || 1000) - 100
    } else if (destinationIndex >= destinationTasks.length) {
      // Moving to bottom
      const lastTask = destinationTasks[destinationTasks.length - 1]
      newOrder = (lastTask.order || 1000) + 100
    } else {
      // Moving between tasks
      const beforeTask = destinationTasks[destinationIndex - 1]
      const afterTask = destinationTasks[destinationIndex]
      const beforeOrder = beforeTask ? beforeTask.order || 1000 : 500
      const afterOrder = afterTask ? afterTask.order || 1000 : 1500
      newOrder = (beforeOrder + afterOrder) / 2
    }

    // Update task with new order only
    console.log(
      `[Vertical Reorder] Updating task ${taskId} with order ${newOrder}`
    )
    updateTask(taskId, { order: newOrder })
  }

  const handleTaskDelete = async taskId => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !confirm(`Delete task "${task.title}"?`)) {
      return
    }
    try {
      await deleteTask(taskId)
      addNotification({
        type: 'success',
        message: 'Task deleted successfully'
      })
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to delete task: ${error.message || 'server error'}`
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

  // v3.1.4 — clicking a task opens the right-side inspector. The modal
  // path stays only for new-task creation (multi-step wizard surface
  // per the inspector-vs-modal rules).
  const handleTaskClick = task => {
    const { openTaskInspector } = useAppStore.getState()
    openTaskInspector(task.id)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedTask(null)

    if (searchParams.get('task')) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('task')
      navigate(`?${newParams.toString()}`, { replace: true })
    }
  }

  const handleNavigateToMeeting = meetingId => {
    const { selectMeeting } = useAppStore.getState()
    selectMeeting(meetingId)

    const projectId = searchParams.get('project')
    if (projectId) {
      const shortMeetingId = getShortId(meetingId)
      navigate(`/?project=${projectId}&meeting=${shortMeetingId}`)
    }
  }

  const handleCreateTask = () => {
    const newTask = {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium'
    }
    setSelectedTask(newTask)
    setIsModalOpen(true)
  }

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
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsMenuOpen(false)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              setIsMenuOpen(false)
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label="Close menu"
                        />
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
              <DragDropContext onDragEnd={onDragEnd}>
                <div
                  ref={kanbanScrollRef}
                  className="flex gap-4 overflow-x-auto pb-4 kanban-scroll-container"
                  style={{ minHeight: '600px' }}
                >
                  {columns.map(column => (
                    <div key={column.id} className="flex-none w-80">
                      <h3 className="font-semibold text-sm text-foreground px-2 py-1 mb-3 bg-secondary rounded-lg">
                        {column.title} ({column.tasks.length})
                      </h3>
                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 min-h-32 p-2 rounded-lg border border-dashed border-transparent"
                            style={{
                              backgroundColor: snapshot.isDraggingOver
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'transparent',
                              borderColor: snapshot.isDraggingOver
                                ? 'rgb(59, 130, 246)'
                                : 'transparent'
                            }}
                          >
                            {column.tasks.map((task, index) => (
                              <Draggable
                                key={task.id}
                                draggableId={task.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                      ...provided.draggableProps.style,
                                      opacity: snapshot.isDragging ? 0.8 : 1
                                    }}
                                  >
                                    <TaskCard
                                      task={task}
                                      onDelete={handleTaskDelete}
                                      onClick={handleTaskClick}
                                      onNavigateToMeeting={
                                        handleNavigateToMeeting
                                      }
                                      users={users}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </DragDropContext>
            ) : (
              <SimpleListView
                tasks={tasks}
                onTaskClick={handleTaskClick}
                onTaskDelete={handleTaskDelete}
              />
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
