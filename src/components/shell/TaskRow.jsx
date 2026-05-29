/*
 * TaskRow — DESIGN.md v3.1.6.
 *
 * The atomic unit of the Tasks view. One row = one task.
 *
 * Grid layout:
 *   [status 20px] [id 56px] [title 1fr] [ai+priority chips auto] [due auto] [avatar auto]
 *
 * Resting row height: 32px. padding 6/8, gap 10.
 *
 * States:
 *   - hover     bg-elevated
 *   - selected  bg-emphasis  (when inspector is open with this task)
 *   - focused   left-inset accent shadow  (when keyboard-focused)
 *
 * Status dot click cycles status (todo → in-progress → done → todo).
 * Clicking the row body opens the inspector via openTaskInspector.
 */

import { Sparkles } from 'lucide-react'
import React from 'react'
import useAppStore from '../../stores/useAppStore'

const STATUS_CYCLE = ['todo', 'in-progress', 'done', 'todo']

const PRIORITY_TONE = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-info/15 text-info'
}
const PRIORITY_LABEL = { high: 'High', medium: 'Med', low: 'Low' }

function StatusDot({ status, onCycle }) {
  // Visual variants per spec: hollow (todo), 3/4 conic fill (in-progress),
  // solid (done), solid danger (blocked).
  let inner = null
  switch (status) {
    case 'done':
      inner = <span className="block w-3 h-3 rounded-full bg-success" />
      break
    case 'blocked':
      inner = <span className="block w-3 h-3 rounded-full bg-destructive" />
      break
    case 'in-progress':
      inner = (
        <span
          className="block w-3 h-3 rounded-full border-[1.5px] border-info"
          style={{
            background:
              'conic-gradient(hsl(var(--info)) 270deg, transparent 270deg 360deg)'
          }}
        />
      )
      break
    case 'todo':
    default:
      inner = (
        <span className="block w-3 h-3 rounded-full border-[1.5px] border-muted-foreground" />
      )
      break
  }

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onCycle?.()
      }}
      className="flex items-center justify-center w-5 h-5 -ml-0.5 rounded-sm hover:bg-muted transition-colors"
      aria-label={`Status: ${status}. Click to cycle.`}
    >
      {inner}
    </button>
  )
}

function AiChip() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-emphasis bg-primary/15 text-primary border border-primary/40 flex-shrink-0">
      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
      AI
    </span>
  )
}

function PriorityChip({ priority }) {
  if (!priority) {
    return null
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-emphasis flex-shrink-0 ${
        PRIORITY_TONE[priority] || PRIORITY_TONE.medium
      }`}
    >
      {PRIORITY_LABEL[priority] || 'Med'}
    </span>
  )
}

function Avatar({ name }) {
  if (!name) {
    return <span className="w-4 h-4 flex-shrink-0" />
  }
  const initial = name.charAt(0).toUpperCase()
  return (
    <span
      className="w-[18px] h-[18px] rounded-full text-primary-foreground text-[9px] font-emphasis flex items-center justify-center flex-shrink-0"
      style={{
        background:
          'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)'
      }}
      title={name}
    >
      {initial}
    </span>
  )
}

function formatDueDate(due) {
  if (!due) {
    return ''
  }
  try {
    const d = new Date(due)
    if (isNaN(d.getTime())) {
      return ''
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
    if (diffDays === 0) {
      return 'Today'
    }
    if (diffDays === 1) {
      return 'Tomorrow'
    }
    if (diffDays === -1) {
      return 'Yesterday'
    }
    if (diffDays > 0 && diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: 'short' })
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function TaskRow({ task, focused = false, onFocus }) {
  const currentTaskId = useAppStore(state => state.currentTaskId)
  const openTaskInspector = useAppStore(state => state.openTaskInspector)
  const updateTask = useAppStore(state => state.updateTask)

  const selected = currentTaskId === task.id
  const isAi =
    Boolean(task.meetingId) ||
    Boolean(task.aiMetadata) ||
    (task.aiDiscoveredLinks && task.aiDiscoveredLinks.length > 0)

  const cycleStatus = () => {
    const i = STATUS_CYCLE.indexOf(task.status || 'todo')
    const next = STATUS_CYCLE[i + 1] || 'todo'
    updateTask(task.id, { status: next })
  }

  const open = () => openTaskInspector(task.id)

  const assigneeName =
    (task.assignees && task.assignees[0]) || task.assignee || null

  const dueLabel = formatDueDate(task.dueDate)

  return (
    <div
      role="row"
      tabIndex={-1}
      onClick={open}
      onFocus={onFocus}
      data-task-row={task.id}
      className={
        'grid items-center gap-2.5 px-2 py-1.5 rounded-sm cursor-pointer transition-colors min-h-[32px] outline-none ' +
        (selected ? 'bg-secondary ' : 'hover:bg-muted ') +
        (focused ? 'shadow-[inset_3px_0_0_hsl(var(--primary))] ' : '')
      }
      style={{
        gridTemplateColumns: '20px 56px minmax(0,1fr) auto auto auto auto'
      }}
    >
      <StatusDot status={task.status || 'todo'} onCycle={cycleStatus} />
      <span className="font-mono text-[11px] text-muted-foreground tracking-[-0.02em] truncate">
        {task.id?.slice(0, 8) || '—'}
      </span>
      <span
        className={
          'text-[13px] font-emphasis truncate ' +
          (task.status === 'done'
            ? 'text-muted-foreground line-through'
            : 'text-foreground')
        }
      >
        {task.title || 'Untitled'}
      </span>
      {isAi ? <AiChip /> : <span className="w-0" />}
      <PriorityChip priority={task.priority} />
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums min-w-[40px] text-right">
        {dueLabel}
      </span>
      <Avatar name={assigneeName} />
    </div>
  )
}
