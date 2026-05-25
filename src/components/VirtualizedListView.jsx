import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Trash2, User } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { List } from 'react-window'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const TaskRowComponent = ({ index, style, data }) => {
  // Add safety checks for data
  if (!data || !data.tasks) {
    return <div style={style}>Loading...</div>
  }

  const { tasks, onTaskClick, onTaskDelete, users = [] } = data
  const task = tasks[index]

  if (!task) {
    return <div style={style}>No task</div>
  }

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
    let assigneesList = []
    if (task.assignees && Array.isArray(task.assignees)) {
      assigneesList = task.assignees
    } else if (task.assignee) {
      assigneesList = [task.assignee]
    }

    if (assigneesList.length === 0) {
      return null
    }

    const displayAssignee = assigneesList[0]
    const isDbUser = isAssigneeDbUser(displayAssignee)
    const user = users.find(
      u =>
        u.name.toLowerCase() === displayAssignee.toLowerCase() ||
        u.email.toLowerCase() === displayAssignee.toLowerCase()
    )

    return (
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
            isDbUser
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
          }`}
        >
          <User className="h-2.5 w-2.5" />
          <span className="truncate max-w-16" title={user ? `${user.name} (${user.email})` : displayAssignee}>
            {isDbUser && user ? user.name.split(' ')[0] : displayAssignee.split(' ')[0]}
          </span>
          {isDbUser && (
            <div className="w-1 h-1 bg-green-500 rounded-full" title="Database User" />
          )}
        </div>
        {assigneesList.length > 1 && (
          <span className="text-xs text-gray-500">+{assigneesList.length - 1}</span>
        )}
      </div>
    )
  }

  const getPriorityBadge = priority => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div
      style={style}
      className="group flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors"
      onClick={() => onTaskClick(task)}
    >
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {task.title}
          </h4>
          <span
            className={`text-xs px-2 py-1 rounded-full border font-medium ${getPriorityBadge(task.priority)}`}
          >
            {task.priority?.charAt(0).toUpperCase() || 'M'}
          </span>
        </div>
        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {getAssigneesDisplay(task)}

        {task.dueDate && (
          <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded border border-orange-200 dark:border-orange-800">
            {(() => {
              const parts = task.dueDate.split('-')
              if (parts.length === 3) {
                const date = new Date(parts[0], parts[1] - 1, parts[2])
                return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
              }
              return new Date(task.dueDate).toLocaleDateString([], { month: 'numeric', day: 'numeric' })
            })()}
          </span>
        )}

        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
          {new Date(task.createdAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all"
          onClick={e => {
            e.stopPropagation()
            onTaskDelete(task.id)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

const VirtualizedStatusList = ({
  title,
  tasks = [],
  color,
  isExpanded,
  onToggle,
  onTaskClick,
  onTaskDelete,
  users = []
}) => {
  // Ensure tasks is always an array
  const validTasks = Array.isArray(tasks) ? tasks : []
  const listHeight = Math.min(validTasks.length * 70 + 20, 400) // Max height of 400px

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
                <div style={{ height: listHeight }}>
                  <List
                    height={listHeight}
                    itemCount={validTasks.length}
                    itemSize={70}
                    itemData={{
                      tasks: validTasks,
                      onTaskClick,
                      onTaskDelete,
                      users
                    }}
                  >
                    {TaskRowComponent}
                  </List>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function VirtualizedListView({
  tasks = [],
  onTaskClick,
  onTaskDelete,
  users = []
}) {
  // Ensure tasks is always an array
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
    if (!Array.isArray(tasks)) {return []}
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
        <VirtualizedStatusList
          key={id}
          title={title}
          tasks={tasks}
          color={color}
          isExpanded={expandedSections[id]}
          onToggle={() => toggleSection(id)}
          onTaskClick={onTaskClick}
          onTaskDelete={onTaskDelete}
          users={users}
        />
      ))}
    </div>
  )
}