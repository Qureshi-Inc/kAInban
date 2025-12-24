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
import React, { useState, useEffect, useMemo } from 'react'
import { Kanban } from 'react-kanban-kit'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getShortId } from '../lib/utils'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import TaskDetailModal from './TaskDetailModal'
import TaskGroupingModal from './TaskGroupingModal'
import SimpleListView from './SimpleListView'
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

  return (
    <div
      className="group bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg hover:shadow-2xl cursor-pointer backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-gradient-to-br hover:from-gray-50/50 hover:to-white dark:hover:from-gray-700/50 dark:hover:to-gray-800"
      onClick={() => onClick(task)}
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

  // Handle opening specific task from URL
  useEffect(() => {
    if (taskToOpen && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskToOpen)
      if (task) {
        setSelectedTask(task)
        setIsModalOpen(true)
      }
    }
  }, [taskToOpen, tasks])

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

  // Prepare data for react-kanban-kit
  const dataSource = useMemo(() => {
    const todoTasks = sortTasksByOrder(
      tasks.filter(task => task.status === 'todo' || !task.status)
    )
    const inProgressTasks = sortTasksByOrder(
      tasks.filter(
        task => task.status === 'in-progress' || task.status === 'inprogress'
      )
    )
    const doneTasks = sortTasksByOrder(
      tasks.filter(task => task.status === 'done')
    )
    const blockedTasks = sortTasksByOrder(
      tasks.filter(task => task.status === 'blocked' || task.status === 'on-hold')
    )

    // Create the data structure expected by react-kanban-kit
    const data = {
      root: {
        id: 'root',
        title: 'Kanban Board',
        children: ['todo', 'in-progress', 'done', 'blocked'],
        totalChildrenCount: 4,
        parentId: null,
      },
      'todo': {
        id: 'todo',
        title: '📋 To Do',
        children: todoTasks.map(task => task.id),
        totalChildrenCount: todoTasks.length,
        parentId: 'root',
      },
      'in-progress': {
        id: 'in-progress',
        title: '⚡ In Progress',
        children: inProgressTasks.map(task => task.id),
        totalChildrenCount: inProgressTasks.length,
        parentId: 'root',
      },
      'done': {
        id: 'done',
        title: '✅ Done',
        children: doneTasks.map(task => task.id),
        totalChildrenCount: doneTasks.length,
        parentId: 'root',
      },
      'blocked': {
        id: 'blocked',
        title: '🚫 Blocked',
        children: blockedTasks.map(task => task.id),
        totalChildrenCount: blockedTasks.length,
        parentId: 'root',
      },
    }

    // Add all tasks to the data object
    const allTasks = [...todoTasks, ...inProgressTasks, ...doneTasks, ...blockedTasks]
    allTasks.forEach(task => {
      data[task.id] = {
        id: task.id,
        title: task.title,
        parentId: task.status === 'in-progress' || task.status === 'inprogress' ? 'in-progress' :
                  task.status === 'done' ? 'done' :
                  task.status === 'blocked' || task.status === 'on-hold' ? 'blocked' : 'todo',
        children: [],
        totalChildrenCount: 0,
        type: 'card',
        content: task,
      }
    })

    return data
  }, [tasks])

  const configMap = useMemo(() => ({
    card: {
      render: ({ data, column, index, isDraggable }) => (
        <TaskCard
          task={data.content}
          onDelete={handleTaskDelete}
          onClick={handleTaskClick}
          onNavigateToMeeting={handleNavigateToMeeting}
          users={users}
        />
      ),
      isDraggable: true,
    }
  }), [users])

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

  const handleCardMove = (move) => {
    console.log('[KanbanBoardKit] Card moved:', move)

    // Extract task ID and new column ID from the move object
    const taskId = move.cardId
    const newStatus = move.toColumnId

    handleTaskMove(taskId, newStatus)
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

    const newParams = new URLSearchParams(searchParams)
    newParams.set('task', task.id)
    navigate(`?${newParams.toString()}`, { replace: false })
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
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsMenuOpen(false)}
                        />
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
              <div className="w-full" style={{ height: '600px' }}>
                <Kanban
                  dataSource={dataSource}
                  configMap={configMap}
                  onCardMove={handleCardMove}
                />
              </div>
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