import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  User,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  Flag,
  Link,
  ChevronDown,
  Sparkles,
  Check,
  Brain,
  Search
} from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import useAppStore from '../stores/useAppStore'

export default function TaskDetailModal({ task, isOpen, onClose }) {
  const { updateTask, deleteTask, addNotification, tasks, linkTasks, unlinkTasks, getLinkedTasks, acceptAiSuggestion, rejectAiSuggestion, updateCurrentProject } = useAppStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [assignee, setAssignee] = useState('')
  const [subtasks, setSubtasks] = useState([])
  const [newSubtask, setNewSubtask] = useState('')
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [linkedTasks, setLinkedTasks] = useState([])
  const [aiCreatedLinks, setAiCreatedLinks] = useState([])
  const [aiDiscoveredLinks, setAiDiscoveredLinks] = useState([])
  const [showLinkedTasksDropdown, setShowLinkedTasksDropdown] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')

  // Parse description for bullet points and convert to subtasks
  const parseSubtasksFromDescription = (description) => {
    if (!description) return []

    // Match bullet points with various formats:
    // - Item, * Item, • Item, 1. Item, etc.
    const bulletRegex = /^[\s]*[-*•]\s+(.+)$/gm
    const numberedRegex = /^[\s]*\d+[\.)]\s+(.+)$/gm

    const bullets = []
    let match

    // Extract bullet points
    while ((match = bulletRegex.exec(description)) !== null) {
      bullets.push(match[1].trim())
    }

    // Extract numbered items
    while ((match = numberedRegex.exec(description)) !== null) {
      bullets.push(match[1].trim())
    }

    return bullets.map((text, index) => ({
      id: `subtask-${Date.now()}-${index}`,
      text,
      completed: false
    }))
  }

  // Initialize form from task
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLinkedTasksDropdown && !event.target.closest('.task-link-dropdown')) {
        setShowLinkedTasksDropdown(false)
        setLinkSearchQuery('') // Clear search when closing
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLinkedTasksDropdown])

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setStatus(task.status || 'todo')
      setPriority(task.priority || 'medium')
      setDueDate(task.dueDate || '')
      setAssignee(task.assignee || '')

      // If task already has subtasks, use them
      // Otherwise, parse from description
      if (task.subtasks && task.subtasks.length > 0) {
        setSubtasks(task.subtasks)
      } else {
        const parsedSubtasks = parseSubtasksFromDescription(task.description)
        if (parsedSubtasks.length > 0) {
          setSubtasks(parsedSubtasks)
          // Auto-save the parsed subtasks immediately
          updateTask(task.id, {
            subtasks: parsedSubtasks
          })
        }
      }

      setComments(task.comments || [])
      setLinkedTasks(task.linkedTasks || [])
      setAiCreatedLinks(task.aiCreatedLinks || [])
      setAiDiscoveredLinks(task.aiDiscoveredLinks || [])
    }
  }, [task])

  const handleSave = async () => {
    if (!task) return

    const updates = {
      title,
      description,
      status,
      priority,
      dueDate,
      assignee,
      subtasks,
      comments,
      linkedTasks,
      aiCreatedLinks,
      aiDiscoveredLinks
    }

    updateTask(task.id, updates)

    // Force save to backend
    setTimeout(async () => {
      try {
        await updateCurrentProject()
      } catch (error) {
        console.error('[TaskDetailModal] ✗ Failed to save task to backend:', error)
        addNotification({
          type: 'error',
          message: 'Failed to save to backend. Changes may be lost on refresh.'
        })
      }
    }, 100)

    addNotification({
      type: 'success',
      message: 'Task updated successfully!'
    })
    onClose()
  }

  const handleDelete = () => {
    if (!task) return

    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask(task.id)
      addNotification({
        type: 'success',
        message: 'Task deleted'
      })
      onClose()
    }
  }

  const addSubtask = () => {
    if (!newSubtask.trim()) return

    const subtask = {
      id: `subtask-${Date.now()}`,
      text: newSubtask,
      completed: false
    }

    setSubtasks([...subtasks, subtask])
    setNewSubtask('')
  }

  const toggleSubtask = (subtaskId) => {
    setSubtasks(subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    ))
  }

  const deleteSubtask = (subtaskId) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId))
  }

  const addComment = () => {
    if (!newComment.trim()) return

    const comment = {
      id: `comment-${Date.now()}`,
      text: newComment,
      author: assignee || 'You',
      timestamp: new Date().toISOString()
    }

    setComments([...comments, comment])
    setNewComment('')
  }

  const handleLinkTask = (taskToLinkId) => {

    if (!linkedTasks.includes(taskToLinkId)) {
      const updatedLinkedTasks = [...linkedTasks, taskToLinkId]
      setLinkedTasks(updatedLinkedTasks)

      // Use bidirectional linking function and save to backend
      if (task) {
        linkTasks(task.id, updatedLinkedTasks)

        // Force save to backend
        setTimeout(async () => {
          try {
            await updateCurrentProject()
          } catch (error) {
            console.error('[TaskDetailModal] ✗ Failed to save project to backend:', error)
            addNotification({
              type: 'error',
              message: 'Failed to save to backend. Changes may be lost on refresh.'
            })
          }
        }, 100)

        addNotification({
          type: 'success',
          message: 'Task linked successfully!'
        })
      } else {
        console.error('[TaskDetailModal] No task to update!')
      }
    } else {
    }
    setShowLinkedTasksDropdown(false)
    setLinkSearchQuery('') // Clear search when closing
  }

  const handleUnlinkTask = (taskToUnlinkId) => {
    const updatedLinkedTasks = linkedTasks.filter(id => id !== taskToUnlinkId)
    setLinkedTasks(updatedLinkedTasks)

    // Use bidirectional unlinking function and save to backend
    if (task) {
      unlinkTasks(task.id, taskToUnlinkId)

      // Force save to backend
      setTimeout(async () => {
        try {
          await updateCurrentProject()
        } catch (error) {
          console.error('[TaskDetailModal] ✗ Failed to save project to backend after unlink:', error)
          addNotification({
            type: 'error',
            message: 'Failed to save to backend. Changes may be lost on refresh.'
          })
        }
      }, 100)

      addNotification({
        type: 'success',
        message: 'Task unlinked successfully!'
      })
    }
  }

  // Get available tasks for linking (exclude current task and already linked tasks)
  const getAvailableTasksForLinking = () => {
    if (!task) return []
    let availableTasks = tasks.filter(t =>
      t.id !== task.id &&
      !linkedTasks.includes(t.id) &&
      !aiCreatedLinks.includes(t.id) &&
      !aiDiscoveredLinks.includes(t.id)
    )

    // Filter by search query if provided
    if (linkSearchQuery.trim()) {
      const query = linkSearchQuery.toLowerCase().trim()
      availableTasks = availableTasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      )
    }

    return availableTasks
  }

  const handleAcceptAiSuggestion = (suggestionId, suggestionType) => {
    acceptAiSuggestion(task.id, suggestionId, suggestionType)

    // Update local state
    setLinkedTasks([...linkedTasks, suggestionId])
    if (suggestionType === 'created') {
      setAiCreatedLinks(aiCreatedLinks.filter(id => id !== suggestionId))
    } else if (suggestionType === 'discovered') {
      setAiDiscoveredLinks(aiDiscoveredLinks.filter(id => id !== suggestionId))
    }

    addNotification({
      type: 'success',
      message: 'AI suggestion accepted and added to linked tasks'
    })
  }

  const handleRejectAiSuggestion = (suggestionId, suggestionType) => {
    rejectAiSuggestion(task.id, suggestionId, suggestionType)

    // Update local state
    if (suggestionType === 'created') {
      setAiCreatedLinks(aiCreatedLinks.filter(id => id !== suggestionId))
    } else if (suggestionType === 'discovered') {
      setAiDiscoveredLinks(aiDiscoveredLinks.filter(id => id !== suggestionId))
    }

    addNotification({
      type: 'info',
      message: 'AI suggestion rejected'
    })
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'text-green-600 bg-green-50 border-green-200'
      case 'in-progress': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'blocked': return 'text-red-600 bg-red-50 border-red-200'
      case 'on-hold': return 'text-red-600 bg-red-50 border-red-200' // Legacy support, treated as blocked
      case 'todo': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const completedSubtasks = subtasks.filter(st => st.completed).length
  const totalSubtasks = subtasks.length
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  if (!isOpen || !task) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold w-full bg-transparent border-none focus:outline-none focus:ring-0"
                placeholder="Task title..."
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-4"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status and Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border font-medium ${getStatusColor(status)}`}
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border font-medium ${getPriorityColor(priority)}`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Due Date and Assignee Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
                {dueDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(dueDate)}
                  </p>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assignee
                </label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Task Relationships */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block flex items-center gap-2">
                <Link className="h-4 w-4" />
                Task Relationships ({linkedTasks.length + aiCreatedLinks.length + aiDiscoveredLinks.length})
              </label>

              <div className="space-y-4">
                {/* Manual Linked Tasks */}
                {linkedTasks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                      <Link className="h-3 w-3" />
                      Manual Links ({linkedTasks.length}) - Auto-complete
                    </h4>
                    <div className="space-y-1">
                      {linkedTasks.map(linkedTaskId => {
                        const linkedTask = tasks.find(t => t.id === linkedTaskId)
                        if (!linkedTask) return null

                        return (
                          <div key={linkedTaskId} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                linkedTask.status === 'done' ? 'bg-green-500' :
                                linkedTask.status === 'in-progress' ? 'bg-blue-500' :
                                linkedTask.status === 'blocked' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`} />
                              <span className="text-sm truncate">{linkedTask.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                linkedTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                linkedTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {linkedTask.priority}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlinkTask(linkedTaskId)}
                              className="h-6 w-6 p-0 hover:bg-red-100 text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* AI Created Links */}
                {aiCreatedLinks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      AI Created Links ({aiCreatedLinks.length}) - From transcript analysis
                    </h4>
                    <div className="space-y-1">
                      {aiCreatedLinks.map(aiLinkId => {
                        const aiLinkedTask = tasks.find(t => t.id === aiLinkId)
                        if (!aiLinkedTask) return null

                        return (
                          <div key={aiLinkId} className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                aiLinkedTask.status === 'done' ? 'bg-green-500' :
                                aiLinkedTask.status === 'in-progress' ? 'bg-blue-500' :
                                aiLinkedTask.status === 'blocked' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`} />
                              <span className="text-sm truncate">{aiLinkedTask.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                aiLinkedTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                aiLinkedTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {aiLinkedTask.priority}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAcceptAiSuggestion(aiLinkId, 'created')}
                                className="h-6 w-6 p-0 hover:bg-green-100 text-green-600"
                                title="Accept and promote to manual link"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectAiSuggestion(aiLinkId, 'created')}
                                className="h-6 w-6 p-0 hover:bg-red-100 text-red-500"
                                title="Reject AI suggestion"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* AI Discovered Links */}
                {aiDiscoveredLinks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Discovered Links ({aiDiscoveredLinks.length}) - Found when completing tasks
                    </h4>
                    <div className="space-y-1">
                      {aiDiscoveredLinks.map(aiDiscoveredId => {
                        const aiDiscoveredTask = tasks.find(t => t.id === aiDiscoveredId)
                        if (!aiDiscoveredTask) return null

                        return (
                          <div key={aiDiscoveredId} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                aiDiscoveredTask.status === 'done' ? 'bg-green-500' :
                                aiDiscoveredTask.status === 'in-progress' ? 'bg-blue-500' :
                                aiDiscoveredTask.status === 'blocked' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`} />
                              <span className="text-sm truncate">{aiDiscoveredTask.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                aiDiscoveredTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                aiDiscoveredTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {aiDiscoveredTask.priority}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAcceptAiSuggestion(aiDiscoveredId, 'discovered')}
                                className="h-6 w-6 p-0 hover:bg-green-100 text-green-600"
                                title="Accept and promote to manual link"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectAiSuggestion(aiDiscoveredId, 'discovered')}
                                className="h-6 w-6 p-0 hover:bg-red-100 text-red-500"
                                title="Reject AI suggestion"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add Manual Link Dropdown */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Add Manual Link</h4>
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLinkedTasksDropdown(!showLinkedTasksDropdown)}
                      className="w-full justify-between"
                      disabled={getAvailableTasksForLinking().length === 0}
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        {getAvailableTasksForLinking().length === 0 ? 'No tasks available to link' : 'Link a task'}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>

                    {showLinkedTasksDropdown && (
                      <div className="task-link-dropdown absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={linkSearchQuery}
                              onChange={(e) => setLinkSearchQuery(e.target.value)}
                              placeholder="Search tasks..."
                              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Task List */}
                        <div className="max-h-48 overflow-y-auto">
                          {getAvailableTasksForLinking().length > 0 ? (
                            getAvailableTasksForLinking().map(availableTask => (
                              <button
                                key={availableTask.id}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleLinkTask(availableTask.id)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                              >
                                <div className={`w-2 h-2 rounded-full ${
                                  availableTask.status === 'done' ? 'bg-green-500' :
                                  availableTask.status === 'in-progress' ? 'bg-blue-500' :
                                  availableTask.status === 'blocked' ? 'bg-red-500' :
                                  'bg-gray-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{availableTask.title}</div>
                                  <div className="text-xs text-gray-500 truncate">{availableTask.description || 'No description'}</div>
                                </div>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  availableTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                  availableTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>
                                  {availableTask.priority}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-6 text-center text-sm text-gray-500">
                              {linkSearchQuery.trim() ?
                                `No tasks found matching "${linkSearchQuery}"` :
                                'No tasks available to link'
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a detailed description..."
                rows={4}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none"
              />
            </div>

            {/* Subtasks/Checklist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Subtasks ({completedSubtasks}/{totalSubtasks})
                </label>
                {totalSubtasks > 0 && (
                  <span className="text-xs text-gray-500">
                    {Math.round(progress)}% complete
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {totalSubtasks > 0 && (
                <div className="w-full h-2 bg-gray-200 rounded-full mb-3">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Subtask List */}
              <div className="space-y-2 mb-3">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <button
                      onClick={() => toggleSubtask(subtask.id)}
                      className="flex-shrink-0"
                    >
                      {subtask.completed ? (
                        <CheckSquare className="h-5 w-5 text-green-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    <span className={`flex-1 ${subtask.completed ? 'line-through text-gray-500' : ''}`}>
                      {subtask.text}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubtask(subtask.id)}
                      className="h-8 w-8 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Subtask */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
                  placeholder="Add a subtask..."
                  className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <Button onClick={addSubtask} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Comments/Activity */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </label>

              {/* Comment List */}
              <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                {comments.map((comment) => (
                  <Card key={comment.id} className="p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm">{comment.author}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(comment.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {comment.text}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Add Comment */}
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
                  placeholder="Add a comment... (Press Enter to post)"
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none"
                />
                <Button onClick={addComment} size="sm" className="self-end">
                  Post
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50 dark:bg-gray-900">
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete Task
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
