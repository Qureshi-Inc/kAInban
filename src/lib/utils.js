import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function generateId() {
  // Use more unique timestamp + longer random to reduce 8-char collisions
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 12) // Longer random part
  return `${timestamp}_${random}`
}

export function getShortId(fullId) {
  // Use first 12 chars to avoid timestamp collisions for projects created quickly
  return fullId.slice(0, 12)
}

// Parse description for bullet points and convert to subtasks
export function parseSubtasksFromDescription(description) {
  if (!description) {return []}

  // Split by lines and look for bullet patterns
  const lines = description.split('\n')
  const bullets = []
  let currentBullet = null
  let currentNested = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if this is a main bullet point
    const mainBulletMatch = line.match(/^[\s]*[*•-]\s+(.+)$/) || line.match(/^[\s]*\d+[\.)]\s+(.+)$/)

    if (mainBulletMatch) {
      // Save previous bullet if exists
      if (currentBullet) {
        bullets.push({
          text: currentBullet,
          nested: currentNested.slice() // Copy array
        })
      }

      // Start new bullet
      currentBullet = mainBulletMatch[1].trim()
      currentNested = []
    } else {
      // Check if this is a nested bullet point (indented)
      const nestedMatch = line.match(/^[\s]{2,}[*•-]\s+(.+)$/) || line.match(/^[\s]{2,}\d+[\.)]\s+(.+)$/)

      if (nestedMatch && currentBullet) {
        currentNested.push(nestedMatch[1].trim())
      } else if (line.trim() && currentBullet) {
        // Continue the current bullet text (multi-line)
        currentBullet += ' ' + line.trim()
      }
    }
  }

  // Don't forget the last bullet
  if (currentBullet) {
    bullets.push({
      text: currentBullet,
      nested: currentNested
    })
  }

  // Convert to subtask format
  const timestamp = Date.now()
  return bullets.map((bullet, index) => ({
    id: `subtask-${timestamp}-${Math.random().toString(36).substr(2, 9)}-${index}`,
    text: bullet.text,
    completed: false,
    hasNested: bullet.nested.length > 0,
    nestedItems: bullet.nested ? [...bullet.nested] : [], // Create a copy of nested items
    originalText: bullet.text
  }))
}

export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function throttle(func, limit) {
  let inThrottle
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Match assignee name to existing users
export const matchAssigneeToUser = (assigneeName, users) => {
  if (!assigneeName || !users || users.length === 0) {
    return assigneeName
  }

  const trimmedName = assigneeName.trim()

  // Exact name match (case insensitive)
  const exactMatch = users.find(user =>
    user.name.toLowerCase() === trimmedName.toLowerCase()
  )
  if (exactMatch) {
    return exactMatch.name
  }

  // Email match (case insensitive)
  const emailMatch = users.find(user =>
    user.email.toLowerCase() === trimmedName.toLowerCase()
  )
  if (emailMatch) {
    return emailMatch.name
  }

  // First name match (higher priority than partial matches to handle ambiguity)
  const firstNameMatches = users.filter(user => {
    const firstName = user.name.split(' ')[0].toLowerCase()
    return firstName === trimmedName.toLowerCase()
  })

  if (firstNameMatches.length === 1) {
    // Single first name match - perfect!
    return firstNameMatches[0].name
  } else if (firstNameMatches.length > 1) {
    // Multiple first name matches - ambiguous!
    console.warn(`[matchAssigneeToUser] Ambiguous assignment: "${assigneeName}" matches multiple users:`,
      firstNameMatches.map(u => `${u.name} (${u.email})`))
    console.warn(`[matchAssigneeToUser] To resolve, use full name like "${firstNameMatches[0].name}" or email like "${firstNameMatches[0].email}"`)
    // Return original to avoid wrong assignment
    return assigneeName
  }

  // Partial name match (case insensitive, contains) - only if no first name matches
  const partialMatches = users.filter(user =>
    user.name.toLowerCase().includes(trimmedName.toLowerCase()) ||
    trimmedName.toLowerCase().includes(user.name.toLowerCase())
  )

  if (partialMatches.length === 1) {
    // Single partial match
    return partialMatches[0].name
  } else if (partialMatches.length > 1) {
    // Multiple partial matches - ambiguous!
    console.warn(`[matchAssigneeToUser] Ambiguous assignment: "${assigneeName}" partially matches multiple users:`,
      partialMatches.map(u => `${u.name} (${u.email})`))
    console.warn(`[matchAssigneeToUser] To resolve, use full name like "${partialMatches[0].name}" or email like "${partialMatches[0].email}"`)
    // Return original to avoid wrong assignment
    return assigneeName
  }

  // No match found, return original
  return assigneeName
}

// Handle multiple assignees - can be a string or array
export const processAssignees = (assigneeData, users = []) => {
  if (!assigneeData) {return []}

  // Ensure users is always an array
  const safeUsers = Array.isArray(users) ? users : []

  // If it's already an array, process each item
  if (Array.isArray(assigneeData)) {
    return assigneeData.map(assignee => matchAssigneeToUser(assignee, safeUsers)).filter(Boolean)
  }

  // If it's a string, split by common separators and process each
  if (typeof assigneeData === 'string') {
    const assignees = assigneeData
      .split(/[,;\/&]|\s+and\s+|\s+\+\s+/) // Split by comma, semicolon, slash, &, 'and', '+'
      .map(assignee => assignee.trim())
      .filter(Boolean)

    if (assignees.length === 1) {
      const matched = matchAssigneeToUser(assignees[0], safeUsers)
      return matched ? [matched] : []
    }

    return assignees.map(assignee => matchAssigneeToUser(assignee, safeUsers)).filter(Boolean)
  }

  return []
}