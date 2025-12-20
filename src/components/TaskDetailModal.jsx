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
  Search,
  Mail,
  Phone,
  FileText,
  Code,
  Zap,
  Copy,
  ExternalLink,
  Loader2
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import { parseSubtasksFromDescription } from '../lib/utils'
import { Button } from './ui/button'
import { Card } from './ui/card'

// Helper function to render **text** as bold
const renderWithBold = (text) => {
  if (!text) return text

  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

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
  const [serverComments, setServerComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [linkedTasks, setLinkedTasks] = useState([])
  const [aiCreatedLinks, setAiCreatedLinks] = useState([])
  const [aiDiscoveredLinks, setAiDiscoveredLinks] = useState([])
  const [showLinkedTasksDropdown, setShowLinkedTasksDropdown] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [aiContentModal, setAiContentModal] = useState({ isOpen: false, title: '', content: '', type: '' })
  const [loadingAiAction, setLoadingAiAction] = useState(null) // Track which AI action is loading


  // Clean description by removing bullet points that became subtasks
  const getCleanDescription = (originalDescription, subtasks) => {
    if (!originalDescription || subtasks.length === 0) {
      return originalDescription
    }

    let cleanDescription = originalDescription

    // Remove bullet point lines that became subtasks
    subtasks.forEach(subtask => {
      // Create regex patterns to match the original bullet point lines
      const patterns = [
        new RegExp(`^[\\s]*[*•-]\\s+${subtask.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'gm'),
        new RegExp(`^[\\s]*\\d+[\\.)]\s+${subtask.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'gm')
      ]

      patterns.forEach(pattern => {
        cleanDescription = cleanDescription.replace(pattern, '')
      })
    })

    // Clean up extra newlines and whitespace
    cleanDescription = cleanDescription
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n')
      .trim()

    return cleanDescription
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

  const handleSave = async() => {
    if (!task) {return}

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
    setTimeout(async() => {
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
    if (!task) {return}

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
    if (!newSubtask.trim()) {return}

    const subtask = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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


  const handleLinkTask = (taskToLinkId) => {

    if (!linkedTasks.includes(taskToLinkId)) {
      const updatedLinkedTasks = [...linkedTasks, taskToLinkId]
      setLinkedTasks(updatedLinkedTasks)

      // Use bidirectional linking function and save to backend
      if (task) {
        linkTasks(task.id, updatedLinkedTasks)

        // Force save to backend
        setTimeout(async() => {
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
      setTimeout(async() => {
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
    if (!task) {return []}
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
    if (!dateString) {return 'Not set'}
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

    if (diffMins < 1) {return 'Just now'}
    if (diffMins < 60) {return `${diffMins}m ago`}
    if (diffHours < 24) {return `${diffHours}h ago`}
    if (diffDays < 7) {return `${diffDays}d ago`}
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const completedSubtasks = subtasks.filter(st => st.completed).length
  const totalSubtasks = subtasks.length
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  // AI Helper Functions
  const getAiSuggestions = (subtaskText) => {
    const text = subtaskText.toLowerCase()
    const suggestions = []

    // Email suggestions
    if (text.includes('email') || text.includes('send') || text.includes('notify') || text.includes('contact')) {
      suggestions.push({
        type: 'email',
        icon: Mail,
        label: 'Generate Email',
        action: () => generateEmailTemplate(subtaskText)
      })
    }

    // Document suggestions
    if (text.includes('document') || text.includes('write') || text.includes('draft') || text.includes('proposal')) {
      suggestions.push({
        type: 'document',
        icon: FileText,
        label: 'Document Template',
        action: () => generateDocumentTemplate(subtaskText)
      })
    }

    // Code suggestions
    if (text.includes('code') || text.includes('script') || text.includes('develop') || text.includes('implement')) {
      suggestions.push({
        type: 'code',
        icon: Code,
        label: 'Code Template',
        action: () => generateCodeTemplate(subtaskText)
      })
    }

    return suggestions
  }

  const generateEmailTemplate = async(subtaskText) => {
    try {
      setLoadingAiAction('email')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const emailTemplate = await openaiService.generateEmailTemplate(taskContext, subtaskText)

      // Show in modal for easy copying
      setAiContentModal({
        isOpen: true,
        title: 'AI Generated Email Template',
        content: emailTemplate,
        type: 'email'
      })

      addNotification({
        type: 'success',
        message: 'Email template generated successfully!'
      })
    } catch (error) {
      console.error('Email generation error:', error)
      addNotification({
        type: 'error',
        message: `Failed to generate email: ${error.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const generateDocumentTemplate = async(subtaskText) => {
    try {
      setLoadingAiAction('document')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const docTemplate = await openaiService.generateDocumentTemplate(taskContext, subtaskText)

      // Show in modal for easy copying
      setAiContentModal({
        isOpen: true,
        title: 'AI Generated Document Template',
        content: docTemplate,
        type: 'document'
      })

      addNotification({
        type: 'success',
        message: 'Document template generated successfully!'
      })
    } catch (error) {
      console.error('Document generation error:', error)
      addNotification({
        type: 'error',
        message: `Failed to generate document: ${error.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const generateCodeTemplate = async(subtaskText) => {
    try {
      setLoadingAiAction('code')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const codeTemplate = await openaiService.generateCodeTemplate(taskContext, subtaskText)

      // Show in modal for easy copying
      setAiContentModal({
        isOpen: true,
        title: 'AI Generated Code Template',
        content: codeTemplate,
        type: 'code'
      })

      addNotification({
        type: 'success',
        message: 'Code template generated successfully!'
      })
    } catch (error) {
      console.error('Code generation error:', error)
      addNotification({
        type: 'error',
        message: `Failed to generate code: ${error.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const createTaskFromSubtask = (subtask) => {
    const { createTask } = useAppStore.getState()

    // Create nested subtasks from the parsed nested items
    const nestedSubtasks = subtask.nestedItems.map((nestedText, index) => ({
      id: `nested-${Date.now()}-${index}`,
      text: nestedText,
      completed: false
    }))

    // Create new task with proper hierarchy
    const newTask = {
      title: subtask.text,
      description: `Created from subtask with ${nestedSubtasks.length} nested items`,
      priority: 'medium',
      status: 'todo',
      subtasks: nestedSubtasks,
      linkedTasks: [task.id] // Link back to parent task
    }

    createTask(newTask)

    addNotification({
      type: 'success',
      message: `Created task "${subtask.text}" with ${nestedSubtasks.length} subtasks`
    })
  }

  // Load comments from server
  const loadServerComments = async() => {
    if (!task?.id) {return}

    setLoadingComments(true)
    try {
      const comments = await apiService.getTaskComments(task.id)
      setServerComments(comments)
    } catch (error) {
      console.error('Failed to load comments:', error)
      addNotification({
        type: 'error',
        message: 'Failed to load comments'
      })
    } finally {
      setLoadingComments(false)
    }
  }

  const addComment = async() => {
    if (!newComment.trim() || !task?.id) {return}

    try {
      const result = await apiService.addTaskComment(task.id, newComment.trim(), 'user')
      if (result.success) {
        setNewComment('')
        // Reload comments to get the updated list
        await loadServerComments()
        addNotification({
          type: 'success',
          message: 'Comment added successfully'
        })
      } else {
        throw new Error(result.error || 'Failed to add comment')
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
      addNotification({
        type: 'error',
        message: `Failed to add comment: ${error.message}`
      })
    }
  }

  const addAiComment = async(content, metadata = null) => {
    if (!task?.id) {return}

    try {
      const result = await apiService.addTaskComment(task.id, content, 'ai_update', metadata)
      if (result.success) {
        // Reload comments to get the updated list
        await loadServerComments()
        return result
      } else {
        throw new Error(result.error || 'Failed to add AI comment')
      }
    } catch (error) {
      console.error('Failed to add AI comment:', error)
      addNotification({
        type: 'error',
        message: `Failed to record AI update: ${error.message}`
      })
      return { success: false, error: error.message }
    }
  }

  // Load comments when task changes
  useEffect(() => {
    if (isOpen && task?.id) {
      loadServerComments()
    }
  }, [isOpen, task?.id])


  if (!isOpen || !task) {return null}

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="mobile-modal-overlay modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overscroll-none"
        onClick={onClose}
        style={{
          position: 'fixed',
          overflow: 'hidden',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="mobile-modal-content task-modal-mobile bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] md:max-h-[90vh] sm:max-h-[95vh] overflow-hidden flex flex-col"
          style={{
            maxHeight: 'calc(100vh - 2rem)',
            minHeight: '300px'
          }}
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
          <div
            className="flex-1 overflow-y-auto p-6 space-y-6"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
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
                        if (!linkedTask) {return null}

                        return (
                          <div key={linkedTaskId} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                linkedTask.status === 'done' ? 'bg-green-500' :
                                  linkedTask.status === 'in-progress' ? 'bg-blue-500' :
                                    linkedTask.status === 'blocked' ? 'bg-red-500' :
                                      'bg-gray-400'
                              }`}
                              />
                              <span className="text-sm truncate">{linkedTask.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                linkedTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                  linkedTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-blue-100 text-blue-600'
                              }`}
                              >
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
                        if (!aiLinkedTask) {return null}

                        return (
                          <div key={aiLinkId} className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                aiLinkedTask.status === 'done' ? 'bg-green-500' :
                                  aiLinkedTask.status === 'in-progress' ? 'bg-blue-500' :
                                    aiLinkedTask.status === 'blocked' ? 'bg-red-500' :
                                      'bg-gray-400'
                              }`}
                              />
                              <span className="text-sm truncate">{aiLinkedTask.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                aiLinkedTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                  aiLinkedTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-blue-100 text-blue-600'
                              }`}
                              >
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
                        if (!aiDiscoveredTask) {return null}

                        return (
                          <div key={aiDiscoveredId} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                aiDiscoveredTask.status === 'done' ? 'bg-green-500' :
                                  aiDiscoveredTask.status === 'in-progress' ? 'bg-blue-500' :
                                    aiDiscoveredTask.status === 'blocked' ? 'bg-red-500' :
                                      'bg-gray-400'
                              }`}
                              />
                              <span className="text-sm truncate">{aiDiscoveredTask.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                aiDiscoveredTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                  aiDiscoveredTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-blue-100 text-blue-600'
                              }`}
                              >
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
                                }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{availableTask.title}</div>
                                  <div className="text-xs text-gray-500 truncate">{availableTask.description || 'No description'}</div>
                                </div>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  availableTask.priority === 'high' ? 'bg-red-100 text-red-600' :
                                    availableTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                      'bg-blue-100 text-blue-600'
                                }`}
                                >
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
                {subtasks.length > 0 && (
                  <span className="text-xs text-blue-600 ml-2">(Bullet points moved to subtasks)</span>
                )}
              </label>
              <textarea
                value={getCleanDescription(description, subtasks)}
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
                {subtasks.map((subtask) => {
                  const aiSuggestions = getAiSuggestions(subtask.text)

                  return (
                    <div
                      key={subtask.id}
                      className="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all"
                    >
                      <button
                        onClick={() => toggleSubtask(subtask.id)}
                        className="flex-shrink-0 mt-1"
                      >
                        {subtask.completed ? (
                          <CheckSquare className="h-5 w-5 text-green-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={`${subtask.completed ? 'line-through text-gray-500' : ''}`}>
                          {subtask.text}
                        </div>

                        {/* AI Action Icons */}
                        {aiSuggestions.length > 0 && !subtask.completed && (
                          <div className="mt-2 space-y-1">
                            {/* AI Actions Header */}
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-blue-500 flex-shrink-0" />
                              <span className="text-xs text-gray-600 font-medium">AI Actions</span>
                            </div>
                            {/* AI Action Buttons */}
                            <div className="flex flex-wrap items-center gap-1">
                              {aiSuggestions.map((suggestion, index) => {
                                const isLoading = loadingAiAction === suggestion.type
                                return (
                                  <Button
                                    key={index}
                                    variant="ghost"
                                    size="sm"
                                    onClick={suggestion.action}
                                    disabled={isLoading || loadingAiAction !== null}
                                    className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 flex items-center gap-1.5 min-w-0 disabled:opacity-50"
                                    title={isLoading ? 'Generating...' : suggestion.label}
                                  >
                                    {isLoading ? (
                                      <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                                    ) : (
                                      <suggestion.icon className="h-3 w-3 flex-shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {isLoading ? 'Generating...' : suggestion.label}
                                    </span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Create Task from Subtask (if has nested content) */}
                        {subtask.hasNested && subtask.nestedItems && subtask.nestedItems.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => createTaskFromSubtask(subtask)}
                            className="h-8 w-8 text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                            title="Create task from this subtask"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Delete Subtask */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSubtask(subtask.id)}
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
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
                Comments ({serverComments.length})
                {loadingComments && <div className="animate-spin h-3 w-3 border border-gray-300 border-t-gray-600 rounded-full" />}
              </label>

              {/* Comment List */}
              <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                {serverComments.map((comment) => (
                  <Card key={comment.id} className={`p-3 ${comment.comment_type === 'ai_update' ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {comment.comment_type !== 'ai_update' && (
                          <span className="font-medium text-sm">{comment.author_name}</span>
                        )}
                        {comment.comment_type === 'ai_update' && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">AI Update</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(new Date(comment.created_at))}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {renderWithBold(comment.content)}
                    </p>
                  </Card>
                ))}
                {serverComments.length === 0 && !loadingComments && (
                  <p className="text-sm text-gray-500 text-center py-4">No comments yet. Add the first comment below.</p>
                )}
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

      {/* AI Content Modal */}
      <AnimatePresence>
        {aiContentModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
            onClick={() => setAiContentModal({ ...aiContentModal, isOpen: false })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    {aiContentModal.type === 'email' && <Mail className="h-4 w-4 text-blue-600" />}
                    {aiContentModal.type === 'document' && <FileText className="h-4 w-4 text-blue-600" />}
                    {aiContentModal.type === 'code' && <Code className="h-4 w-4 text-blue-600" />}
                  </div>
                  {aiContentModal.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAiContentModal({ ...aiContentModal, isOpen: false })}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="relative">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border overflow-x-auto">
                    {aiContentModal.content}
                  </pre>
                </div>
              </div>

              {/* Footer with Copy Button */}
              <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Generated by AI • Ready to use
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAiContentModal({ ...aiContentModal, isOpen: false })}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={async() => {
                      try {
                        await navigator.clipboard.writeText(aiContentModal.content)
                        addNotification({
                          type: 'success',
                          message: 'Content copied to clipboard!'
                        })
                        setAiContentModal({ ...aiContentModal, isOpen: false })
                      } catch (error) {
                        // If clipboard fails, try to select the text
                        const textArea = document.createElement('textarea')
                        textArea.value = aiContentModal.content
                        document.body.appendChild(textArea)
                        textArea.select()
                        textArea.setSelectionRange(0, 99999) // For mobile devices
                        try {
                          document.execCommand('copy')
                          addNotification({
                            type: 'success',
                            message: 'Content copied to clipboard!'
                          })
                          setAiContentModal({ ...aiContentModal, isOpen: false })
                        } catch (err) {
                          addNotification({
                            type: 'info',
                            message: 'Please manually select and copy the text above.'
                          })
                        } finally {
                          document.body.removeChild(textArea)
                        }
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}
