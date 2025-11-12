import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, CheckSquare, Plus, MoreVertical } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import useAppStore from '../stores/useAppStore'
import openaiService from '../services/openaiService'
import TaskDetailModal from './TaskDetailModal'

const TaskCard = ({ task, onStatusChange, onDelete, onClick }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-400 bg-gradient-to-br from-red-50 to-red-100 text-red-900 shadow-red-100'
      case 'medium': return 'border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-900 shadow-amber-100'
      case 'low': return 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-900 shadow-emerald-100'
      default: return 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 shadow-gray-100'
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      whileHover={{ scale: 1.03, y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group task-card bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3 shadow-md hover:shadow-2xl cursor-pointer backdrop-blur-sm transition-all hover:border-primary/50"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
      }}
      onClick={() => onClick(task)}
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-sm line-clamp-2 flex-1 pr-2 text-gray-900 dark:text-gray-100">{task.title}</h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all"
          onClick={(e) => {
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
          <span className={`text-xs px-3 py-1.5 rounded-full border-2 font-bold ${getPriorityColor(task.priority)} w-fit shadow-md`}>
            {task.priority.toUpperCase()}
          </span>
          {task.dueDate && (
            <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-800">
              📅 {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  )
}

const Column = ({ title, status, tasks, onTaskMove, onTaskDelete, onTaskClick, count, columnColor, allTasks }) => {
  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')

    // Find the task to check its current status
    const task = allTasks.find(t => t.id === taskId)

    // Only move if the task is being moved to a different column
    if (task && task.status !== status) {
      onTaskMove(taskId, status)
    }
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
    <Card className={`kanban-column min-h-[500px] transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${getColumnStyle()}`}>
      <CardHeader className="pb-4 sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm z-10 border-b border-gray-200/50 dark:border-gray-700/50">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="font-bold text-lg">{title}</span>
          <motion.span
            className="bg-gradient-to-r from-primary/20 to-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold shadow-sm ring-1 ring-primary/20"
            whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            {count}
          </motion.span>
        </CardTitle>
      </CardHeader>
      <CardContent
        className="pt-0"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-2 min-h-[400px] p-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onTaskMove}
              onDelete={onTaskDelete}
              onClick={onTaskClick}
            />
          ))}
          {tasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-[400px] text-muted-foreground"
            >
              <div className="text-6xl mb-4 opacity-20">📋</div>
              <p className="text-sm italic font-medium">Drop tasks here</p>
              <p className="text-xs mt-1 opacity-60">Drag and drop to organize</p>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function KanbanBoard() {
  const { tasks, moveTask, updateTask, deleteTask, clearTasks, addTask, addNotification, addAiDiscoveredLinks } = useAppStore()
  const [selectedTask, setSelectedTask] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Add CSS for drag and drop visual feedback
  React.useEffect(() => {

    const style = document.createElement('style')
    style.textContent = `
      .drag-over {
        background: rgba(59, 130, 246, 0.08) !important;
        border-color: rgba(59, 130, 246, 0.4) !important;
        transform: scale(1.02) !important;
        box-shadow: 0 20px 40px rgba(59, 130, 246, 0.15) !important;
      }

      .drag-over .space-y-2 {
        background: rgba(59, 130, 246, 0.04);
        border: 2px dashed rgba(59, 130, 246, 0.4);
        border-radius: 12px;
        transition: all 0.2s ease;
      }

      .task-card {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
      }

      .task-card:hover:not(.dragging) {
        cursor: grab;
        transform: translateY(-4px) scale(1.02);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
      }

      .task-card:active {
        cursor: grabbing;
      }

      .task-card.dragging {
        pointer-events: none;
        z-index: 1000;
        transform: rotate(5deg) scale(1.05);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
      }

      /* Ensure drop zones can receive events */
      .kanban-column .pt-0 {
        pointer-events: auto !important;
      }

      .kanban-column .space-y-2 {
        pointer-events: auto !important;
      }

      /* Smooth column transitions */
      .kanban-column {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Dark mode drag feedback */
      .dark .drag-over {
        background: rgba(59, 130, 246, 0.15) !important;
        border-color: rgba(59, 130, 246, 0.5) !important;
      }

      .dark .drag-over .space-y-2 {
        background: rgba(59, 130, 246, 0.08);
        border-color: rgba(59, 130, 246, 0.5);
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const todoTasks = tasks.filter(task => task.status === 'todo' || !task.status)
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress' || task.status === 'inprogress')
  const blockedTasks = tasks.filter(task => task.status === 'blocked' || task.status === 'on-hold') // Include legacy on-hold
  const doneTasks = tasks.filter(task => task.status === 'done')


  const handleTaskMove = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

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

  const handleTaskDelete = (taskId) => {
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
    if (tasks.length === 0) return

    if (confirm('Clear all tasks? This cannot be undone.')) {
      clearTasks()
      addNotification({
        type: 'success',
        message: 'All tasks cleared'
      })
    }
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedTask(null)
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
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
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
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMenuOpen(false)}
                      />

                      {/* Menu */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                      >
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <Column
              title="📋 To Do"
              status="todo"
              tasks={todoTasks}
              count={todoTasks.length}
              onTaskMove={handleTaskMove}
              onTaskDelete={handleTaskDelete}
              onTaskClick={handleTaskClick}
              allTasks={tasks}
            />
            <Column
              title="⚡ In Progress"
              status="in-progress"
              tasks={inProgressTasks}
              count={inProgressTasks.length}
              onTaskMove={handleTaskMove}
              onTaskDelete={handleTaskDelete}
              onTaskClick={handleTaskClick}
              allTasks={tasks}
            />
            <Column
              title="✅ Done"
              status="done"
              tasks={doneTasks}
              count={doneTasks.length}
              onTaskMove={handleTaskMove}
              onTaskDelete={handleTaskDelete}
              onTaskClick={handleTaskClick}
              allTasks={tasks}
            />
            <Column
              title="🚫 Blocked"
              status="blocked"
              tasks={blockedTasks}
              count={blockedTasks.length}
              onTaskMove={handleTaskMove}
              onTaskDelete={handleTaskDelete}
              onTaskClick={handleTaskClick}
              allTasks={tasks}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </>
  )
}