import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const TaskRow = ({ task, onTaskClick, onTaskDelete }) => {
  if (!task) return null

  const getPriorityIcon = priority => {
    const colors = {
      high: 'bg-red-500',
      medium: 'bg-amber-500',
      low: 'bg-green-500'
    }
    return colors[priority] || 'bg-gray-400'
  }

  return (
    <div
      className="group flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors"
      onClick={() => onTaskClick(task)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-3 h-3 rounded-full ${getPriorityIcon(task.priority)}`} title={`${task.priority} priority`} />
        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
          {task.title}
        </h4>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
        onClick={e => {
          e.stopPropagation()
          onTaskDelete(task.id)
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

const StatusList = ({
  title,
  tasks = [],
  color,
  isExpanded,
  onToggle,
  onTaskClick,
  onTaskDelete
}) => {
  const validTasks = Array.isArray(tasks) ? tasks : []

  return (
    <Card className={`border-l-4 ${color} dark:bg-gray-800`}>
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors py-3"
        onClick={onToggle}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="text-base">{title}</span>
            <span className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">
              {validTasks.length}
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
            <CardContent className="pt-0 px-0">
              {validTasks.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-gray-500 italic">No tasks in this status</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {validTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                      onTaskDelete={onTaskDelete}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function SimpleListView({
  tasks = [],
  onTaskClick,
  onTaskDelete
}) {
  const validTasks = Array.isArray(tasks) ? tasks : []

  const [expandedSections, setExpandedSections] = useState({
    todo: true,
    'in-progress': true,
    blocked: true,
    done: true
  })

  const toggleSection = status => {
    setExpandedSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  const sortTasksByOrder = tasks => {
    if (!Array.isArray(tasks)) return []
    return tasks.filter(task => task).sort((a, b) => {
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

  const statusData = useMemo(() => {
    const todoTasks = sortTasksByOrder(
      validTasks.filter(task => task && (task.status === 'todo' || !task.status))
    )
    const inProgressTasks = sortTasksByOrder(
      validTasks.filter(task => task && (task.status === 'in-progress' || task.status === 'inprogress'))
    )
    const blockedTasks = sortTasksByOrder(
      validTasks.filter(task => task && (task.status === 'blocked' || task.status === 'on-hold'))
    )
    const doneTasks = sortTasksByOrder(
      validTasks.filter(task => task && task.status === 'done')
    )

    return [
      {
        id: 'todo',
        title: '📋 To Do',
        tasks: todoTasks,
        color: 'border-l-slate-400 bg-slate-50 dark:bg-slate-900/20'
      },
      {
        id: 'in-progress',
        title: '⚡ In Progress',
        tasks: inProgressTasks,
        color: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
      },
      {
        id: 'blocked',
        title: '🚫 Blocked',
        tasks: blockedTasks,
        color: 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
      },
      {
        id: 'done',
        title: '✅ Done',
        tasks: doneTasks,
        color: 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
      }
    ]
  }, [validTasks])

  return (
    <div className="space-y-4">
      {statusData.map(({ id, title, tasks, color }) => (
        <StatusList
          key={id}
          title={title}
          tasks={tasks}
          color={color}
          isExpanded={expandedSections[id]}
          onToggle={() => toggleSection(id)}
          onTaskClick={onTaskClick}
          onTaskDelete={onTaskDelete}
        />
      ))}
    </div>
  )
}