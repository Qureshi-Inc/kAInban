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
  FileText,
  Code,
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { parseSubtasksFromDescription } from '../lib/utils'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Card } from './ui/card'
import '../styles/mobile-ux.css'

// Helper function to render **text** as bold
const renderWithBold = text => {
  if (!text) {
    return text
  }

  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

// MeetingSource component to display source meeting information
const MeetingSource = ({ meetingId, onClose }) => {
  const meetings = useAppStore(state => state.meetings)
  const selectMeeting = useAppStore(state => state.selectMeeting)

  if (!meetingId) {
    return null
  }

  const meeting = meetings.find(m => m.id === meetingId)
  if (!meeting) {
    return null
  }

  const handleNavigateToMeeting = () => {
    // Close the task detail modal
    onClose()

    // Select the meeting
    selectMeeting(meetingId)

    // Scroll to the meeting summary section
    setTimeout(() => {
      const summaryElement = document.getElementById('meeting-summary')
      if (summaryElement) {
        summaryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
          Source Meeting
        </div>
        <button
          onClick={handleNavigateToMeeting}
          className="text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:underline transition-colors text-left"
        >
          {meeting.name}
        </button>
        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Created: {new Date(meeting.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}

export default function TaskDetailModal({ task, isOpen, onClose }) {
  const {
    updateTask,
    deleteTask,
    addNotification,
    tasks,
    linkTasks,
    unlinkTasks,
    acceptAiSuggestion,
    rejectAiSuggestion,
    updateCurrentProject
  } = useAppStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [assignees, setAssignees] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [newSubtask, setNewSubtask] = useState('')
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [serverComments, setServerComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)

  // @mention functionality
  const [users, setUsers] = useState([])
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 })
  const [filteredUsers, setFilteredUsers] = useState([])
  const [selectedUserIndex, setSelectedUserIndex] = useState(0)
  const [linkedTasks, setLinkedTasks] = useState([])
  const [aiCreatedLinks, setAiCreatedLinks] = useState([])
  const [aiDiscoveredLinks, setAiDiscoveredLinks] = useState([])
  const [showLinkedTasksDropdown, setShowLinkedTasksDropdown] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('')
  const [aiContentModal, setAiContentModal] = useState({
    isOpen: false,
    title: '',
    content: '',
    type: ''
  })
  const [loadingAiAction, setLoadingAiAction] = useState(null) // Track which AI action is loading
  const [contextModal, setContextModal] = useState({
    isOpen: false,
    context: '',
    loading: false
  })
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const modalContentRef = useRef(null)
  const activeInputRef = useRef(null)

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
        new RegExp(
          `^[ \\t]*[*•-][ \\t]+${subtask.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`,
          'gm'
        ),
        new RegExp(
          `^[ \\t]*[0-9]+[.)][ \\t]+${subtask.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`,
          'gm'
        )
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (
        showLinkedTasksDropdown &&
        !event.target.closest('.task-link-dropdown')
      ) {
        setShowLinkedTasksDropdown(false)
        setLinkSearchQuery('') // Clear search when closing
      }
      if (
        showAssigneeDropdown &&
        !event.target.closest('.assignee-dropdown')
      ) {
        setShowAssigneeDropdown(false)
        setAssigneeSearchQuery('') // Clear search when closing
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLinkedTasksDropdown, showAssigneeDropdown])

  // Keyboard and viewport handling for mobile
  useEffect(() => {
    if (!isOpen) {
      return
    }

    // Save current scroll position when modal opens
    const savedScrollPosition =
      window.pageYOffset || document.documentElement.scrollTop
    const savedScrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft

    const initialViewportHeight =
      window.visualViewport?.height || window.innerHeight

    const handleViewportChange = () => {
      if (!window.visualViewport) {
        return
      }

      const currentHeight = window.visualViewport.height
      const heightDifference = initialViewportHeight - currentHeight

      // If viewport height decreased by more than 150px, keyboard is likely open
      const keyboardIsOpen = heightDifference > 150

      setIsKeyboardOpen(keyboardIsOpen)

      // No automatic scrolling - just let the modal adjust its size when keyboard opens
    }

    const handleFocusIn = e => {
      if (e.target.matches('input, textarea, select')) {
        activeInputRef.current = e.target
        e.target.classList.add('mobile-input-focus')

        // Gentle scroll to ensure input is visible without jarring movement
        setTimeout(() => {
          if (e.target && typeof e.target.scrollIntoView === 'function') {
            e.target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            })
          }
        }, 100) // Small delay to let keyboard animation start
      }
    }

    const handleFocusOut = e => {
      if (e.target.matches('input, textarea, select')) {
        e.target.classList.remove('mobile-input-focus')
        activeInputRef.current = null
      }
    }

    // Add event listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
    } else {
      window.addEventListener('resize', handleViewportChange)
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    // Prevent body scroll when modal is open (mobile-friendly approach)
    document.body.style.overflow = 'hidden'
    document.body.classList.add('modal-open')

    // Only use position fixed on non-mobile or when keyboard is not open
    if (!isKeyboardOpen && window.innerWidth > 768) {
      // Set body position to fixed and maintain scroll position
      document.body.style.position = 'fixed'
      document.body.style.top = `-${savedScrollPosition}px`
      document.body.style.left = `-${savedScrollLeft}px`
      document.body.style.width = '100%'
    } else {
      // On mobile, use a different approach that doesn't break when keyboard opens
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.touchAction = 'none'
    }

    return () => {
      // Cleanup
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          'resize',
          handleViewportChange
        )
      } else {
        window.removeEventListener('resize', handleViewportChange)
      }

      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)

      // Restore body scroll
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.touchAction = ''
      document.body.classList.remove('modal-open')

      // Restore scroll position when modal closes
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: savedScrollPosition,
          left: savedScrollLeft,
          behavior: 'instant' // No smooth scrolling to avoid visual jumping
        })
      })
    }
  }, [isOpen, isKeyboardOpen])

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setStatus(task.status || 'todo')
      setPriority(task.priority || 'medium')
      setDueDate(task.dueDate || '')
      // Handle both legacy single assignee and new multi-assignee format
      if (task.assignees && Array.isArray(task.assignees)) {
        setAssignees(task.assignees)
      } else if (task.assignee) {
        setAssignees(task.assignee ? [task.assignee] : [])
      } else {
        setAssignees([])
      }

      // If task already has subtasks, use them (deep clone to prevent reference sharing)
      // Otherwise, parse from description
      if (task.subtasks && task.subtasks.length > 0) {
        setSubtasks(JSON.parse(JSON.stringify(task.subtasks)))
      } else {
        const parsedSubtasks = parseSubtasksFromDescription(task.description)
        if (parsedSubtasks.length > 0) {
          setSubtasks(parsedSubtasks)
          // Auto-save the parsed subtasks immediately
          updateTask(task.id, {
            subtasks: parsedSubtasks
          })
        } else {
          // Clear subtasks if task has none
          setSubtasks([])
        }
      }

      setComments(task.comments || [])
      setLinkedTasks(task.linkedTasks || [])
      setAiCreatedLinks(task.aiCreatedLinks || [])
      setAiDiscoveredLinks(task.aiDiscoveredLinks || [])
    }
  }, [task, updateTask])

  const handleSave = async() => {
    if (!task) {
      return
    }

    // Only include fields that actually changed to prevent unnecessary activity records
    const updates = {}

    // Normalize title and description comparisons (treat empty string, null, and undefined as equivalent)
    const normalizedTitle = title || ''
    const normalizedTaskTitle = task.title || ''
    if (normalizedTitle !== normalizedTaskTitle) {updates.title = title}

    const normalizedDescription = description || ''
    const normalizedTaskDescription = task.description || ''
    if (normalizedDescription !== normalizedTaskDescription) {updates.description = description}
    if (status !== task.status) {updates.status = status}
    if (priority !== task.priority) {updates.priority = priority}

    // Normalize due date comparison (treat empty string, null, and undefined as equivalent)
    const normalizedCurrentDueDate = dueDate || ''
    const normalizedTaskDueDate = task.dueDate || ''
    if (normalizedCurrentDueDate !== normalizedTaskDueDate) {updates.dueDate = dueDate}
    // Check if assignees changed (compare with legacy assignee format)
    const currentAssignees = assignees
    const taskAssignees = task.assignees && Array.isArray(task.assignees) ? task.assignees : (task.assignee ? [task.assignee] : [])
    if (JSON.stringify(currentAssignees) !== JSON.stringify(taskAssignees)) {
      updates.assignees = currentAssignees
      // Also update legacy assignee field for backward compatibility
      updates.assignee = currentAssignees.length > 0 ? currentAssignees[0] : ''
    }

    // Compare arrays and only update if changed
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks)) {updates.subtasks = subtasks}
    if (JSON.stringify(comments) !== JSON.stringify(task.comments)) {updates.comments = comments}
    if (JSON.stringify(linkedTasks) !== JSON.stringify(task.linkedTasks)) {updates.linkedTasks = linkedTasks}
    if (JSON.stringify(aiCreatedLinks) !== JSON.stringify(task.aiCreatedLinks)) {updates.aiCreatedLinks = aiCreatedLinks}
    if (JSON.stringify(aiDiscoveredLinks) !== JSON.stringify(task.aiDiscoveredLinks)) {updates.aiDiscoveredLinks = aiDiscoveredLinks}

    // Handle new task creation vs existing task update
    if (!task.id) {
      // Create new task
      const { createTask } = useAppStore.getState()
      const newTask = {
        title,
        description,
        status,
        priority,
        dueDate,
        assignees,
        assignee: assignees.length > 0 ? assignees[0] : '',
        subtasks,
        comments,
        linkedTasks,
        aiCreatedLinks,
        aiDiscoveredLinks
      }
      createTask(newTask)
      addNotification({
        type: 'success',
        message: 'Task created successfully!'
      })
    } else {
      // Update existing task only if there are changes
      if (Object.keys(updates).length > 0) {
        updateTask(task.id, updates)
        addNotification({
          type: 'success',
          message: 'Task updated successfully!'
        })
      } else {
        addNotification({
          type: 'info',
          message: 'No changes to save'
        })
      }
    }

    // Force save to backend and close modal after completion
    setTimeout(async() => {
      try {
        await updateCurrentProject()
      } catch (error) {
        console.error(
          '[TaskDetailModal] ✗ Failed to save task to backend:',
          error
        )
        addNotification({
          type: 'error',
          message: 'Failed to save to backend. Changes may be lost on refresh.'
        })
      } finally {
        // Always close the modal after backend save attempt (success or failure)
        onClose()
      }
    }, 100)
  }

  const handleDelete = () => {
    if (!task) {
      return
    }

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
    if (!newSubtask.trim()) {
      return
    }

    const subtask = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: newSubtask,
      completed: false
    }

    setSubtasks([...subtasks, subtask])
    setNewSubtask('')
  }

  const toggleSubtask = subtaskId => {
    setSubtasks(
      subtasks.map(st =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      )
    )
  }

  const deleteSubtask = subtaskId => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId))
  }

  const handleLinkTask = taskToLinkId => {
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
            console.error(
              '[TaskDetailModal] ✗ Failed to save project to backend:',
              error
            )
            addNotification({
              type: 'error',
              message:
                'Failed to save to backend. Changes may be lost on refresh.'
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
    }
    setShowLinkedTasksDropdown(false)
    setLinkSearchQuery('') // Clear search when closing
  }

  const handleUnlinkTask = taskToUnlinkId => {
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
          console.error(
            '[TaskDetailModal] ✗ Failed to save project to backend after unlink:',
            error
          )
          addNotification({
            type: 'error',
            message:
              'Failed to save to backend. Changes may be lost on refresh.'
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
    if (!task) {
      return []
    }
    let availableTasks = tasks.filter(
      t =>
        t.id !== task.id &&
        !linkedTasks.includes(t.id) &&
        !aiCreatedLinks.includes(t.id) &&
        !aiDiscoveredLinks.includes(t.id)
    )

    // Filter by search query if provided
    if (linkSearchQuery.trim()) {
      const query = linkSearchQuery.toLowerCase().trim()
      availableTasks = availableTasks.filter(
        t =>
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

  // Assignee management functions
  const handleAddAssignee = (assigneeName) => {
    if (!assignees.includes(assigneeName)) {
      setAssignees([...assignees, assigneeName])
    }
    setShowAssigneeDropdown(false)
    setAssigneeSearchQuery('')
  }

  const handleRemoveAssignee = (assigneeToRemove) => {
    setAssignees(assignees.filter(name => name !== assigneeToRemove))
  }

  // Get available users for assignment (exclude already assigned users)
  const getAvailableUsersForAssignment = () => {
    let availableUsers = users.filter(user => !assignees.includes(user.name))

    // Filter by search query if provided
    if (assigneeSearchQuery.trim()) {
      const query = assigneeSearchQuery.toLowerCase().trim()
      availableUsers = availableUsers.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      )
    }

    return availableUsers
  }

  const getPriorityColor = priority => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusColor = status => {
    switch (status) {
      case 'done':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'in-progress':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'blocked':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'on-hold':
        return 'text-red-600 bg-red-50 border-red-200' // Legacy support, treated as blocked
      case 'todo':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatDate = dateString => {
    if (!dateString) {
      return 'Not set'
    }
    try {
      // Parse as local date to avoid timezone issues
      const parts = dateString.split('-')
      if (parts.length === 3) {
        const date = new Date(parts[0], parts[1] - 1, parts[2])
        return date.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      }
      // Fallback for other formats
      const date = new Date(dateString)
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const formatTimestamp = timestamp => {
    // Handle the timestamp properly - database stores UTC timestamps in format "YYYY-MM-DD HH:mm:ss"
    // Need to explicitly treat them as UTC
    let date
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      // Database format: "2025-12-21 17:39:39" - treat as UTC
      date = new Date(timestamp + ' UTC')
    } else {
      // Standard ISO format or already a Date object
      date = new Date(timestamp)
    }

    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // Handle invalid dates
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }

    if (diffMins < 1) {
      return 'Just now'
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const completedSubtasks = subtasks.filter(st => st.completed).length
  const totalSubtasks = subtasks.length
  const progress =
    totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  // Simple AI Detection - Email and Message only
  const getAiSuggestions = subtaskText => {
    const text = subtaskText.toLowerCase()
    const originalText = subtaskText

    // Check for email first
    const hasEmailWord = text.includes('email')
    const hasEmailAddress =
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(originalText)

    if (hasEmailWord || hasEmailAddress) {
      return [
        {
          type: 'email',
          icon: Mail,
          label: 'Generate Email',
          action: () => generateEmailTemplate(subtaskText)
        }
      ]
    }

    // Check for messaging/communication
    const messageWords = [
      'notify',
      'ping',
      'reach out',
      'contact',
      'inform',
      'tell',
      'engage',
      'slack',
      'message',
      'dm',
      'chat',
      'communicate'
    ]
    const hasMessageWord = messageWords.some(word => text.includes(word))

    if (hasMessageWord) {
      return [
        {
          type: 'message',
          icon: MessageSquare,
          label: 'Draft Message',
          action: () => generateSlackMessage(subtaskText)
        }
      ]
    }

    return []
  }

  const generateEmailTemplate = async subtaskText => {
    try {
      setLoadingAiAction('email')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const emailTemplate = await openaiService.generateEmailTemplate(
        taskContext,
        subtaskText
      )

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

  const generateDocumentTemplate = async subtaskText => {
    try {
      setLoadingAiAction('document')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const docTemplate = await openaiService.generateDocumentTemplate(
        taskContext,
        subtaskText
      )

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

  const generateCodeTemplate = async subtaskText => {
    try {
      setLoadingAiAction('code')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const codeTemplate = await openaiService.generateCodeTemplate(
        taskContext,
        subtaskText
      )

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

  const generateResearchTemplate = async subtaskText => {
    try {
      setLoadingAiAction('research')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const researchTemplate = await openaiService.generateResearchTemplate(
        taskContext,
        subtaskText
      )

      // Show in modal for easy copying
      setAiContentModal({
        isOpen: true,
        title: 'AI Generated Research Guide',
        content: researchTemplate,
        type: 'research'
      })

      addNotification({
        type: 'success',
        message: 'Research guide generated successfully!'
      })
    } catch (error) {
      console.error('Research generation error:', error)
      addNotification({
        type: 'error',
        message: `Failed to generate research guide: ${error.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const generateSlackMessage = async subtaskText => {
    try {
      setLoadingAiAction('message')

      const taskContext = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }

      const slackMessage = await openaiService.generateSlackMessage(
        taskContext,
        subtaskText
      )

      // Show in modal for easy copying
      setAiContentModal({
        isOpen: true,
        title: 'AI Generated Slack Message',
        content: slackMessage,
        type: 'message'
      })

      addNotification({
        type: 'success',
        message: 'Slack message generated successfully!'
      })
    } catch (error) {
      console.error('Message generation error:', error)
      addNotification({
        type: 'error',
        message: `Failed to generate message: ${error.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const handleContextUpdate = async () => {
    if (!contextModal.context.trim()) {
      addNotification({
        type: 'error',
        message: 'Please enter some context'
      })
      return
    }

    setContextModal(prev => ({ ...prev, loading: true }))

    try {
      const taskContext = {
        title,
        description,
        priority,
        status,
        assignees,
        dueDate,
        subtasks: subtasks.map(s => ({ text: s.text, completed: s.completed }))
      }

      const updatedTask = await openaiService.updateTaskWithContext(
        taskContext,
        contextModal.context.trim()
      )

      // Update the local state with the AI suggestions
      if (updatedTask.title && updatedTask.title !== title) {
        setTitle(updatedTask.title)
      }
      if (updatedTask.description && updatedTask.description !== description) {
        setDescription(updatedTask.description)
      }
      if (updatedTask.priority && updatedTask.priority !== priority) {
        setPriority(updatedTask.priority)
      }
      if (updatedTask.status && updatedTask.status !== status) {
        setStatus(updatedTask.status)
      }
      if (updatedTask.dueDate && updatedTask.dueDate !== dueDate) {
        setDueDate(updatedTask.dueDate)
      }
      if (updatedTask.assignees && Array.isArray(updatedTask.assignees)) {
        setAssignees(updatedTask.assignees)
      }
      if (updatedTask.subtasks && Array.isArray(updatedTask.subtasks)) {
        const updatedSubtasks = updatedTask.subtasks.map((subtaskText, index) => ({
          id: subtasks[index]?.id || `subtask-${Date.now()}-${index}`,
          text: subtaskText,
          completed: subtasks[index]?.completed || false
        }))
        setSubtasks(updatedSubtasks)
      }

      // Close modal and show success
      setContextModal({ isOpen: false, context: '', loading: false })

      addNotification({
        type: 'success',
        message: 'Task updated with AI context successfully! Review the changes and save.'
      })
    } catch (error) {
      console.error('Context update error:', error)
      addNotification({
        type: 'error',
        message: `Failed to update task with context: ${error.message}`
      })
    } finally {
      setContextModal(prev => ({ ...prev, loading: false }))
    }
  }

  const createTaskFromSubtask = subtask => {
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
  const loadServerComments = useCallback(async() => {
    if (!task?.id) {
      return
    }

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
  }, [task?.id, addNotification])

  const addComment = async() => {
    if (!newComment.trim() || !task?.id) {
      return
    }

    try {
      const result = await apiService.addTaskComment(
        task.id,
        newComment.trim(),
        'user'
      )
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

  // Load users for @mention functionality
  const loadUsers = useCallback(async() => {
    try {
      const usersData = await apiService.getUsers()
      setUsers(usersData || [])
    } catch (error) {
      console.error('Failed to load users:', error)
      setUsers([])
    }
  }, [])

  // Load comments and users when task changes
  useEffect(() => {
    if (isOpen && task?.id) {
      loadServerComments()
      loadUsers()
    }
  }, [isOpen, task?.id, loadServerComments, loadUsers])

  // Handle @mention functionality
  const handleCommentChange = (e) => {
    const value = e.target.value
    const cursorPosition = e.target.selectionStart

    setNewComment(value)

    // Check for @ mentions
    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // Only show dropdown if @ is followed by word characters (no spaces) and is recent
      if (/^\w*$/.test(textAfterAt) && cursorPosition - lastAtIndex <= 20) {
        setMentionQuery(textAfterAt.toLowerCase())
        setMentionPosition({ start: lastAtIndex, end: cursorPosition })
        setShowMentionDropdown(true)
        setSelectedUserIndex(0)

        // Filter users by query
        const filtered = users.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.email.toLowerCase().includes(textAfterAt.toLowerCase())
        )
        setFilteredUsers(filtered)
      } else {
        setShowMentionDropdown(false)
      }
    } else {
      setShowMentionDropdown(false)
    }
  }

  // Handle mention selection
  const insertMention = (user) => {
    const beforeMention = newComment.substring(0, mentionPosition.start)
    const afterMention = newComment.substring(mentionPosition.end)
    const mentionText = `@${user.name}`

    setNewComment(beforeMention + mentionText + afterMention)
    setShowMentionDropdown(false)
  }

  // Handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e) => {
    if (!showMentionDropdown) {return}

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedUserIndex(prev =>
        prev < filteredUsers.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedUserIndex(prev =>
        prev > 0 ? prev - 1 : filteredUsers.length - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredUsers[selectedUserIndex]) {
        insertMention(filteredUsers[selectedUserIndex])
      }
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false)
    }
  }

  // Function to render comment content with highlighted @mentions
  const renderCommentWithMentions = (content) => {
    if (!content) {return content}

    // Split content by @mentions and render with highlights
    const parts = content.split(/(@\w+)/g)

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const mentionName = part.slice(1)
        const mentionedUser = users.find(user =>
          user.name.toLowerCase() === mentionName.toLowerCase()
        )

        if (mentionedUser) {
          return (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium"
              title={mentionedUser.email}
            >
              <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                {mentionedUser.name.charAt(0).toUpperCase()}
              </span>
              @{mentionedUser.name}
            </span>
          )
        }
      }
      return <span key={index}>{renderWithBold(part)}</span>
    })
  }

  if (!isOpen || !task) {
    return null
  }

  // Detect mobile for specific styling
  const isMobile = window.innerWidth <= 640

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className={`task-modal-overlay ${isKeyboardOpen ? 'keyboard-active' : ''} ${isMobile ? 'mobile-modal' : ''}`}
          role="button"
          aria-label="Close modal"
          onClick={onClose}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              onClose()
            }
          }}
          tabIndex={0}
        >
          <div
            ref={modalContentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            onClick={e => e.stopPropagation()}
            className={`task-modal-content layout-stable ${isKeyboardOpen ? 'keyboard-aware-container' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex-1">
                <input
                  id="task-modal-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 modal-scroll-content">
              {/* Status and Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label
                    htmlFor="task-status"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block"
                  >
                    Status
                  </label>
                  <select
                    id="task-status"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
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
                  <label
                    htmlFor="task-priority"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2"
                  >
                    <Flag className="h-4 w-4" />
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
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
                  <label
                    htmlFor="task-due-date"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Due Date
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                  {dueDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(dueDate)}
                    </p>
                  )}
                </div>

                {/* Assignees */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assignees ({assignees.length})
                  </label>

                  <div className="space-y-4">
                    {/* Current Assignees */}
                    {assignees.length > 0 && (
                      <div>
                        <div className="space-y-1">
                          {assignees.map(assigneeName => {
                            const isDbUser = users.some(user =>
                              user.name.toLowerCase() === assigneeName.toLowerCase() ||
                              user.email.toLowerCase() === assigneeName.toLowerCase()
                            )
                            const user = users.find(u =>
                              u.name.toLowerCase() === assigneeName.toLowerCase() ||
                              u.email.toLowerCase() === assigneeName.toLowerCase()
                            )

                            return (
                              <div
                                key={assigneeName}
                                className={`flex items-center justify-between p-2 border rounded-md ${
                                  isDbUser
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                    : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${
                                    isDbUser ? 'bg-blue-500' : 'bg-gray-500'
                                  }`}
                                  >
                                    {(isDbUser && user ? user.name : assigneeName).charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {isDbUser && user ? user.name : assigneeName}
                                    </div>
                                    {isDbUser && user && (
                                      <div className="text-xs text-gray-500 truncate">
                                        {user.email}
                                      </div>
                                    )}
                                  </div>
                                  {isDbUser && <div className="w-1.5 h-1.5 bg-green-500 rounded-full" title="Database User" />}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAssignee(assigneeName)}
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

                    {/* Add Assignee */}
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                        className="w-full justify-between"
                        disabled={getAvailableUsersForAssignment().length === 0}
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          {getAvailableUsersForAssignment().length === 0
                            ? 'All users assigned'
                            : 'Assign a user'}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>

                      {showAssigneeDropdown && (
                        <div className="assignee-dropdown absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-hidden">
                          {/* Search Input */}
                          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                value={assigneeSearchQuery}
                                onChange={e => setAssigneeSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && assigneeSearchQuery.trim()) {
                                    e.preventDefault()
                                    // If no users match, add as manual assignee
                                    if (getAvailableUsersForAssignment().length === 0) {
                                      handleAddAssignee(assigneeSearchQuery.trim())
                                    }
                                    // If there's exactly one user match, add that user
                                    else if (getAvailableUsersForAssignment().length === 1) {
                                      handleAddAssignee(getAvailableUsersForAssignment()[0].name)
                                    }
                                  }
                                }}
                                placeholder="Search users or type name to add manually..."
                                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* User List */}
                          <div className="max-h-48 overflow-y-auto">
                            {(() => {
                              const availableUsers = getAvailableUsersForAssignment()
                              const hasSearchQuery = assigneeSearchQuery.trim()
                              const showManualOption = hasSearchQuery && availableUsers.length === 0

                              return (
                                <>
                                  {availableUsers.map(availableUser => (
                                    <button
                                      key={availableUser.id}
                                      onClick={e => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleAddAssignee(availableUser.name)
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                        {availableUser.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          {availableUser.name}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          {availableUser.email}
                                        </div>
                                      </div>
                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" title="Database User" />
                                    </button>
                                  ))}

                                  {showManualOption && (
                                    <button
                                      onClick={e => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleAddAssignee(assigneeSearchQuery.trim())
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer bg-green-50/50 dark:bg-green-900/10"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                        +
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          Add "{assigneeSearchQuery.trim()}" as assignee
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          Manual assignee (not a registered user)
                                        </div>
                                      </div>
                                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" title="Manual Assignee" />
                                    </button>
                                  )}

                                  {!hasSearchQuery && availableUsers.length === 0 && (
                                    <div className="px-3 py-6 text-center text-sm text-gray-500">
                                      No users available to assign
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Relationships */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Task Relationships (
                  {linkedTasks.length +
                  aiCreatedLinks.length +
                  aiDiscoveredLinks.length}
                  )
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
                          const linkedTask = tasks.find(
                            t => t.id === linkedTaskId
                          )
                          if (!linkedTask) {
                            return null
                          }

                          return (
                            <div
                              key={linkedTaskId}
                              className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    linkedTask.status === 'done'
                                      ? 'bg-green-500'
                                      : linkedTask.status === 'in-progress'
                                        ? 'bg-blue-500'
                                        : linkedTask.status === 'blocked'
                                          ? 'bg-red-500'
                                          : 'bg-gray-400'
                                  }`}
                                />
                                <span className="text-sm truncate">
                                  {linkedTask.title}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    linkedTask.priority === 'high'
                                      ? 'bg-red-100 text-red-600'
                                      : linkedTask.priority === 'medium'
                                        ? 'bg-yellow-100 text-yellow-600'
                                        : 'bg-blue-100 text-blue-600'
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
                        AI Created Links ({aiCreatedLinks.length}) - From
                        transcript analysis
                      </h4>
                      <div className="space-y-1">
                        {aiCreatedLinks.map(aiLinkId => {
                          const aiLinkedTask = tasks.find(t => t.id === aiLinkId)
                          if (!aiLinkedTask) {
                            return null
                          }

                          return (
                            <div
                              key={aiLinkId}
                              className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    aiLinkedTask.status === 'done'
                                      ? 'bg-green-500'
                                      : aiLinkedTask.status === 'in-progress'
                                        ? 'bg-blue-500'
                                        : aiLinkedTask.status === 'blocked'
                                          ? 'bg-red-500'
                                          : 'bg-gray-400'
                                  }`}
                                />
                                <span className="text-sm truncate">
                                  {aiLinkedTask.title}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    aiLinkedTask.priority === 'high'
                                      ? 'bg-red-100 text-red-600'
                                      : aiLinkedTask.priority === 'medium'
                                        ? 'bg-yellow-100 text-yellow-600'
                                        : 'bg-blue-100 text-blue-600'
                                  }`}
                                >
                                  {aiLinkedTask.priority}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleAcceptAiSuggestion(aiLinkId, 'created')
                                  }
                                  className="h-6 w-6 p-0 hover:bg-green-100 text-green-600"
                                  title="Accept and promote to manual link"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRejectAiSuggestion(aiLinkId, 'created')
                                  }
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
                        AI Discovered Links ({aiDiscoveredLinks.length}) - Found
                        when completing tasks
                      </h4>
                      <div className="space-y-1">
                        {aiDiscoveredLinks.map(aiDiscoveredId => {
                          const aiDiscoveredTask = tasks.find(
                            t => t.id === aiDiscoveredId
                          )
                          if (!aiDiscoveredTask) {
                            return null
                          }

                          return (
                            <div
                              key={aiDiscoveredId}
                              className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    aiDiscoveredTask.status === 'done'
                                      ? 'bg-green-500'
                                      : aiDiscoveredTask.status === 'in-progress'
                                        ? 'bg-blue-500'
                                        : aiDiscoveredTask.status === 'blocked'
                                          ? 'bg-red-500'
                                          : 'bg-gray-400'
                                  }`}
                                />
                                <span className="text-sm truncate">
                                  {aiDiscoveredTask.title}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    aiDiscoveredTask.priority === 'high'
                                      ? 'bg-red-100 text-red-600'
                                      : aiDiscoveredTask.priority === 'medium'
                                        ? 'bg-yellow-100 text-yellow-600'
                                        : 'bg-blue-100 text-blue-600'
                                  }`}
                                >
                                  {aiDiscoveredTask.priority}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleAcceptAiSuggestion(
                                      aiDiscoveredId,
                                      'discovered'
                                    )
                                  }
                                  className="h-6 w-6 p-0 hover:bg-green-100 text-green-600"
                                  title="Accept and promote to manual link"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRejectAiSuggestion(
                                      aiDiscoveredId,
                                      'discovered'
                                    )
                                  }
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
                    <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Add Manual Link
                    </h4>
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setShowLinkedTasksDropdown(!showLinkedTasksDropdown)
                        }
                        className="w-full justify-between"
                        disabled={getAvailableTasksForLinking().length === 0}
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          {getAvailableTasksForLinking().length === 0
                            ? 'No tasks available to link'
                            : 'Link a task'}
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
                                onChange={e => setLinkSearchQuery(e.target.value)}
                                placeholder="Search tasks..."
                                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* Task List */}
                          <div className="max-h-48 overflow-y-auto">
                            {getAvailableTasksForLinking().length > 0 ? (
                              getAvailableTasksForLinking().map(availableTask => (
                                <button
                                  key={availableTask.id}
                                  onClick={e => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleLinkTask(availableTask.id)
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      availableTask.status === 'done'
                                        ? 'bg-green-500'
                                        : availableTask.status === 'in-progress'
                                          ? 'bg-blue-500'
                                          : availableTask.status === 'blocked'
                                            ? 'bg-red-500'
                                            : 'bg-gray-400'
                                    }`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {availableTask.title}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                      {availableTask.description ||
                                      'No description'}
                                    </div>
                                  </div>
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      availableTask.priority === 'high'
                                        ? 'bg-red-100 text-red-600'
                                        : availableTask.priority === 'medium'
                                          ? 'bg-yellow-100 text-yellow-600'
                                          : 'bg-blue-100 text-blue-600'
                                    }`}
                                  >
                                    {availableTask.priority}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-6 text-center text-sm text-gray-500">
                                {linkSearchQuery.trim()
                                  ? `No tasks found matching "${linkSearchQuery}"`
                                  : 'No tasks available to link'}
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
                    <span className="text-xs text-blue-600 ml-2">
                      (Bullet points moved to subtasks)
                    </span>
                  )}
                </label>
                <div className="mobile-input-container">
                  <textarea
                    value={getCleanDescription(description, subtasks)}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add a detailed description..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none"
                  />
                </div>
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
                  {subtasks.map(subtask => {
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
                          <div
                            className={`${subtask.completed ? 'line-through text-gray-500' : ''}`}
                          >
                            {subtask.text}
                          </div>

                          {/* AI Action Icons */}
                          {aiSuggestions.length > 0 && !subtask.completed && (
                            <div className="mt-2 space-y-1">
                              {/* AI Actions Header */}
                              <div className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                <span className="text-xs text-gray-600 font-medium">
                                  AI Actions
                                </span>
                              </div>
                              {/* AI Action Buttons */}
                              <div className="flex flex-wrap items-center gap-1">
                                {aiSuggestions.map((suggestion, index) => {
                                  const isLoading =
                                  loadingAiAction === suggestion.type
                                  return (
                                    <Button
                                      key={index}
                                      variant="ghost"
                                      size="sm"
                                      onClick={suggestion.action}
                                      disabled={
                                        isLoading || loadingAiAction !== null
                                      }
                                      className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 flex items-center gap-1.5 min-w-0 disabled:opacity-50"
                                      title={
                                        isLoading
                                          ? 'Generating...'
                                          : suggestion.label
                                      }
                                    >
                                      {isLoading ? (
                                        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                                      ) : (
                                        <suggestion.icon className="h-3 w-3 flex-shrink-0" />
                                      )}
                                      <span className="truncate">
                                        {isLoading
                                          ? 'Generating...'
                                          : suggestion.label}
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
                          {subtask.hasNested &&
                          subtask.nestedItems &&
                          subtask.nestedItems.length > 0 && (
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
                  <div className="mobile-input-container flex-1">
                    <input
                      type="text"
                      value={newSubtask}
                      onChange={e => setNewSubtask(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addSubtask()}
                      placeholder="Add a subtask..."
                      className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    />
                  </div>
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
                  {loadingComments && (
                    <div className="animate-spin h-3 w-3 border border-gray-300 border-t-gray-600 rounded-full" />
                  )}
                </label>

                {/* Comment List */}
                <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                  {serverComments.map(comment => (
                    <Card
                      key={comment.id}
                      className={`p-3 ${comment.comment_type === 'ai_update' ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {comment.comment_type !== 'ai_update' && (
                            <span className="font-medium text-sm">
                              {comment.author_name}
                            </span>
                          )}
                          {comment.comment_type === 'ai_update' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              AI Update
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {renderCommentWithMentions(comment.content)}
                      </p>
                    </Card>
                  ))}
                  {serverComments.length === 0 && !loadingComments && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No comments yet. Add the first comment below.
                    </p>
                  )}
                </div>

                {/* Add Comment */}
                <div className="flex gap-2">
                  <div className="mobile-input-container flex-1 relative">
                    <textarea
                      value={newComment}
                      onChange={handleCommentChange}
                      onKeyDown={handleMentionKeyDown}
                      onKeyPress={e => {
                        if (showMentionDropdown) {return} // Prevent submission when dropdown is open
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          addComment()
                        }
                      }}
                      placeholder="Add a comment... (Press Enter to post, @ to mention)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none"
                    />

                    {/* @mention dropdown */}
                    {showMentionDropdown && filteredUsers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                        {filteredUsers.map((user, index) => (
                          <div
                            key={user.id}
                            className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              index === selectedUserIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => insertMention(user)}
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={addComment} size="sm" className="self-end">
                    Post
                  </Button>
                </div>
              </div>

              {/* Meeting Source */}
              {task.meetingId && (
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <MeetingSource meetingId={task.meetingId} onClose={onClose} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 dark:bg-gray-900">
              <div className="relative">
                {/* Three-dot menu button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="h-9 w-9"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

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
                        className="absolute left-0 bottom-full mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                      >
                        {/* Add Context option */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false)
                            setContextModal({ isOpen: true, context: '', loading: false })
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center gap-2 transition-colors border-b border-gray-200 dark:border-gray-700"
                        >
                          <Brain className="h-4 w-4" />
                          Add Context
                        </button>

                        {/* Delete option */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false)
                            handleDelete()
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Task
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </div>
          </div>

          {/* AI Content Modal */}
          <AnimatePresence>
            {aiContentModal.isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-[999998] flex items-center justify-center p-4"
                onClick={() =>
                  setAiContentModal({ ...aiContentModal, isOpen: false })
                }
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        {aiContentModal.type === 'email' && (
                          <Mail className="h-4 w-4 text-blue-600" />
                        )}
                        {aiContentModal.type === 'document' && (
                          <FileText className="h-4 w-4 text-blue-600" />
                        )}
                        {aiContentModal.type === 'code' && (
                          <Code className="h-4 w-4 text-blue-600" />
                        )}
                        {aiContentModal.type === 'research' && (
                          <Search className="h-4 w-4 text-blue-600" />
                        )}
                        {aiContentModal.type === 'message' && (
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      {aiContentModal.title}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setAiContentModal({ ...aiContentModal, isOpen: false })
                      }
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
                        onClick={() =>
                          setAiContentModal({ ...aiContentModal, isOpen: false })
                        }
                      >
                        Close
                      </Button>
                      <Button
                        onClick={async() => {
                          try {
                            await navigator.clipboard.writeText(
                              aiContentModal.content
                            )
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
                              setAiContentModal({
                                ...aiContentModal,
                                isOpen: false
                              })
                            } catch (err) {
                              addNotification({
                                type: 'info',
                                message:
                              'Please manually select and copy the text above.'
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

          {/* Context Update Modal */}
          <AnimatePresence>
            {contextModal.isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center p-4"
                onClick={() => setContextModal({ isOpen: false, context: '', loading: false })}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <Brain className="h-4 w-4 text-purple-600" />
                      </div>
                      Add Context to Task
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setContextModal({ isOpen: false, context: '', loading: false })}
                      disabled={contextModal.loading}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Context Information
                      </label>
                      <textarea
                        value={contextModal.context}
                        onChange={e => setContextModal(prev => ({ ...prev, context: e.target.value }))}
                        placeholder="Enter additional context, requirements, or details about this task. AI will use this information to update the task intelligently..."
                        className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        disabled={contextModal.loading}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      The AI will analyze your context and intelligently update the task title, description, priority, assignees, due date, and subtasks as needed.
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50 dark:bg-gray-900">
                    <Button
                      variant="outline"
                      onClick={() => setContextModal({ isOpen: false, context: '', loading: false })}
                      disabled={contextModal.loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleContextUpdate}
                      disabled={contextModal.loading || !contextModal.context.trim()}
                      className="flex items-center gap-2"
                    >
                      {contextModal.loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4" />
                          Update Task
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
