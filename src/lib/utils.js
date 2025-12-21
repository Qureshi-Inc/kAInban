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