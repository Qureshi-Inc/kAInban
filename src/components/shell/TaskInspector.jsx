/*
 * TaskInspector — DESIGN.md v3.1.4 (Slice 3 of v3.1 migration).
 *
 * The right-side inspector that replaces TaskDetailModal as the default
 * surface for reading/editing tasks. Composition matches v3.1.4:
 *
 *   ┌─────────────────────────────────┐
 *   │ TASK-ID    [link] [more] [×]    │  header (44px)
 *   ├─────────────────────────────────┤
 *   │ Detail · Activity · Source      │  tabs
 *   ├─────────────────────────────────┤
 *   │ Title (editable)                │
 *   │                                 │
 *   │ Status / Priority / Assignee /  │  field grid
 *   │ Due / Project                   │
 *   │                                 │
 *   │ ┌─ AI summary (if any) ──────┐  │
 *   │ │ serif body                 │  │
 *   │ │ mono source citation       │  │
 *   │ └────────────────────────────┘  │
 *   │                                 │
 *   │ Subtasks                        │
 *   │ ☐ ...                           │
 *   │                                 │
 *   │ Description (textarea)          │
 *   ├─────────────────────────────────┤
 *   │  Comment       Mark Done        │  footer
 *   └─────────────────────────────────┘
 *
 * What this slice ships:
 *   - All field editing wired (title, status, priority, due, description).
 *   - Subtask toggle/add/delete (full parity with TaskDetailModal subtask UX).
 *   - AI summary surfaced when present (task.aiMetadata or task.meetingId).
 *   - Activity tab: real changes via apiService.getTaskChanges.
 *   - Source tab: meeting source citation when applicable.
 *   - "Open full editor" escape hatch opens TaskDetailModal for power
 *     features (AI actions, comments with mentions, AI content modals,
 *     linked tasks). Those graduate to inspector in a follow-up slice.
 *   - URL sync (?task=<id>) owned by the store actions.
 *   - Mobile: full-screen drawer with back chevron in the header.
 *
 * What's intentionally deferred to a polish PR:
 *   - Inline comments (use Open full editor for now).
 *   - @mentions.
 *   - Linked tasks UI.
 *   - AI content generation menus (email/code/research templates).
 *   - The 6 AI actions canonical list (live in palette already; inline
 *     buttons land alongside subtask UX in Slice 4 polish).
 */

import {
  X,
  Link as LinkIcon,
  MoreVertical,
  ChevronLeft,
  Trash2,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus
} from 'lucide-react'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../../services/apiService'
import useAppStore from '../../stores/useAppStore'
import { getShortId } from '../../lib/utils'
import { Button } from '../ui/button'
import TaskDetailModal from '../TaskDetailModal'

const PRIORITY_LABEL = { high: 'High', medium: 'Med', low: 'Low' }
const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do', dot: 'border-muted-foreground' },
  { value: 'in-progress', label: 'In progress', dot: 'bg-info border-info' },
  { value: 'blocked', label: 'Blocked', dot: 'bg-destructive border-destructive' },
  { value: 'done', label: 'Done', dot: 'bg-success border-success' }
]

function StatusDot({ status, size = 12 }) {
  const cfg = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  return (
    <span
      className={`inline-block rounded-full border-[1.5px] ${cfg.dot}`}
      style={{ width: size, height: size }}
      aria-label={cfg.label}
    />
  )
}

function PriorityChip({ priority }) {
  const tone =
    priority === 'high'
      ? 'bg-destructive/15 text-destructive'
      : priority === 'low'
        ? 'bg-info/15 text-info'
        : 'bg-warning/15 text-warning'
  return (
    <span
      className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-emphasis ${tone}`}
    >
      {PRIORITY_LABEL[priority] || 'Med'}
    </span>
  )
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-emphasis bg-primary/15 text-primary border border-primary/40">
      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
      AI
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[12px]">
      <span className="text-muted-foreground font-emphasis">{label}</span>
      <div className="text-foreground flex items-center gap-1.5 min-w-0">
        {children}
      </div>
    </div>
  )
}

function SubtaskRow({ subtask, onToggle, onRemove }) {
  return (
    <div className="group flex items-center gap-2 px-1 py-1 rounded-sm hover:bg-muted">
      <button
        type="button"
        onClick={onToggle}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={subtask.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {subtask.completed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </button>
      <span
        className={`flex-1 text-[12px] ${
          subtask.completed
            ? 'text-muted-foreground line-through'
            : 'text-foreground'
        }`}
      >
        {subtask.text}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        aria-label="Remove subtask"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function ActivityList({ taskId }) {
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiService
      .getTaskChanges(taskId, 50)
      .then(rows => {
        if (cancelled) return
        setChanges(Array.isArray(rows) ? rows : [])
      })
      .catch(e => {
        if (cancelled) return
        setError(e?.message || 'Failed to load activity')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  if (loading) {
    return (
      <div className="text-[11px] text-muted-foreground italic px-1 py-2">
        Loading activity…
      </div>
    )
  }
  if (error) {
    return <div className="text-[11px] text-destructive px-1 py-2">{error}</div>
  }
  if (changes.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground italic px-1 py-2">
        No activity recorded yet.
      </div>
    )
  }

  const fmtTime = ts => {
    if (!ts) return ''
    try {
      const d = new Date(ts)
      const now = Date.now()
      const diff = (now - d.getTime()) / 1000
      if (diff < 60) return 'just now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
      return d.toLocaleDateString()
    } catch {
      return ''
    }
  }

  return (
    <div className="flex flex-col">
      {changes.map((c, i) => {
        const isAi = (c.metadata?.source || '').includes('ai')
        const who = isAi ? 'AI' : c.user_name || 'Someone'
        const verb = (c.change_type || 'updated').replace(/_/g, ' ')
        const fieldStr = c.field_name ? ` ${c.field_name}` : ''
        const valStr =
          c.new_value && c.field_name && String(c.new_value).length < 60
            ? ` → ${c.new_value}`
            : ''
        return (
          <div
            key={c.id || i}
            className="grid grid-cols-[16px_1fr] gap-2 py-1.5 text-[11px] leading-snug"
          >
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full ml-[3px] ${
                isAi ? 'bg-primary' : 'bg-muted-foreground'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <span className="text-foreground font-emphasis">{who}</span>{' '}
              <span className="text-muted-foreground">
                {verb}
                {fieldStr}
                {valStr}
              </span>
              <span className="text-muted-foreground/70 font-mono ml-2 text-[10px]">
                {fmtTime(c.created_at)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SourceTab({ task }) {
  // Slice 3 surfaces just the meeting source citation. Slice 4 will hang
  // the actual transcript span here once the TranscriptPanel ports into
  // the inspector body.
  const meetings = useAppStore(state => state.meetings)
  const meeting = useMemo(() => {
    if (!task?.meetingId) return null
    return meetings.find(m => m.id === task.meetingId) || null
  }, [task?.meetingId, meetings])

  if (!task?.meetingId) {
    return (
      <div className="text-[11px] text-muted-foreground italic px-1 py-2">
        No source meeting. This task was created manually.
      </div>
    )
  }

  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex items-center gap-2">
        <AiBadge />
        <span className="text-muted-foreground">Extracted from meeting</span>
      </div>
      <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
        <div className="font-serif text-[14px] text-foreground mb-1">
          {meeting?.name || 'Meeting'}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {meeting?.id || task.meetingId}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Transcript span inline-rendering arrives in Slice 4.
      </p>
    </div>
  )
}

export default function TaskInspector() {
  const currentTaskId = useAppStore(state => state.currentTaskId)
  const closeTaskInspector = useAppStore(state => state.closeTaskInspector)
  const openTaskInspector = useAppStore(state => state.openTaskInspector)
  const tasks = useAppStore(state => state.tasks)
  const currentProject = useAppStore(state => state.currentProject)
  const updateTask = useAppStore(state => state.updateTask)
  const deleteTask = useAppStore(state => state.deleteTask)
  const addNotification = useAppStore(state => state.addNotification)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Local draft state — committed to store on blur / explicit save so
  // every keystroke doesn't fan out to the backend save debounce.
  const [titleDraft, setTitleDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [activeTab, setActiveTab] = useState('detail')
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFullEditor, setOpenFullEditor] = useState(false)
  const titleRef = useRef(null)

  // URL sync on mount: if ?task=<id> is in the URL but the store doesn't
  // have currentTaskId, open it. Reverse sync (store → URL) lives in the
  // store actions.
  useEffect(() => {
    const urlTaskId = searchParams.get('task')
    if (urlTaskId && !currentTaskId) {
      openTaskInspector(urlTaskId)
    }
    // intentional: only run on mount / when URL param appears externally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('task')])

  const task = useMemo(
    () => (currentTaskId ? tasks.find(t => t.id === currentTaskId) : null),
    [tasks, currentTaskId]
  )

  // Reset drafts when the task switches.
  useEffect(() => {
    setTitleDraft(task?.title || '')
    setDescriptionDraft(task?.description || '')
    setNewSubtask('')
    setActiveTab('detail')
    setMenuOpen(false)
  }, [task?.id])

  // Keyboard: Esc closes, j/k navigates between tasks in the current
  // project's list. j/k only fire when nothing is focused on a text input,
  // so editing the title doesn't accidentally trigger nav.
  useEffect(() => {
    if (!currentTaskId) return
    const onKey = e => {
      if (e.key === 'Escape') {
        closeTaskInspector()
        return
      }
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

      if (e.key === 'j' || e.key === 'k') {
        const ids = tasks.map(t => t.id)
        const idx = ids.indexOf(currentTaskId)
        if (idx < 0) return
        const nextIdx =
          e.key === 'j'
            ? Math.min(ids.length - 1, idx + 1)
            : Math.max(0, idx - 1)
        if (nextIdx !== idx) {
          e.preventDefault()
          openTaskInspector(ids[nextIdx])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTaskId, tasks, closeTaskInspector, openTaskInspector])

  // ---- mutators ----

  const commitTitle = () => {
    if (!task) return
    const t = titleDraft.trim()
    if (!t || t === task.title) return
    updateTask(task.id, { title: t })
  }
  const commitDescription = () => {
    if (!task) return
    if ((descriptionDraft || '') === (task.description || '')) return
    updateTask(task.id, { description: descriptionDraft })
  }
  const setStatus = status => {
    if (!task || status === task.status) return
    updateTask(task.id, { status })
  }
  const setPriority = priority => {
    if (!task || priority === task.priority) return
    updateTask(task.id, { priority })
  }
  const setDueDate = dueDate => {
    if (!task || dueDate === (task.dueDate || '')) return
    updateTask(task.id, { dueDate: dueDate || null })
  }

  const toggleSubtask = idx => {
    if (!task) return
    const next = [...(task.subtasks || [])]
    if (!next[idx]) return
    next[idx] = { ...next[idx], completed: !next[idx].completed }
    updateTask(task.id, { subtasks: next })
  }
  const removeSubtask = idx => {
    if (!task) return
    const next = [...(task.subtasks || [])]
    next.splice(idx, 1)
    updateTask(task.id, { subtasks: next })
  }
  const addSubtask = () => {
    if (!task || !newSubtask.trim()) return
    const next = [...(task.subtasks || [])]
    next.push({
      id: `subtask-${Date.now()}`,
      text: newSubtask.trim(),
      completed: false
    })
    updateTask(task.id, { subtasks: next })
    setNewSubtask('')
  }

  const markDone = () => {
    if (!task) return
    setStatus(task.status === 'done' ? 'todo' : 'done')
    addNotification({
      type: 'success',
      message:
        task.status === 'done'
          ? 'Marked as to-do'
          : 'Marked done. Nice.'
    })
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm(`Delete task "${task.title || task.id}"?`)) return
    try {
      await deleteTask(task.id)
      closeTaskInspector()
      addNotification({ type: 'success', message: 'Task deleted' })
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Failed to delete task: ${e.message || 'server error'}`
      })
    }
  }

  const copyLink = async () => {
    if (!task) return
    const projectShort = currentProject ? getShortId(currentProject.id) : null
    const params = new URLSearchParams()
    if (projectShort) params.set('project', projectShort)
    params.set('task', task.id)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      addNotification({ type: 'success', message: 'Task link copied' })
    } catch {
      addNotification({
        type: 'info',
        message: `Copy: ${url}`
      })
    }
  }

  // ---- render ----

  if (!task) {
    // No task selected — show the placeholder. AppShell only renders the
    // inspector slot when this component returns non-null AND currentTaskId
    // is set, so this branch is mostly belt-and-suspenders.
    if (!currentTaskId) return null
    return (
      <div className="flex flex-col h-full p-6 text-center">
        <div className="m-auto max-w-[240px]">
          <p className="text-[12px] text-muted-foreground">
            Task not found. It may have been deleted or you may not have
            access. Try a different task.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={closeTaskInspector}
          >
            Close
          </Button>
        </div>
      </div>
    )
  }

  const projectName = currentProject?.name || 'Workspace'
  const isAi =
    Boolean(task.meetingId) ||
    Boolean(task.aiMetadata) ||
    (task.aiDiscoveredLinks && task.aiDiscoveredLinks.length > 0)

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* Header */}
      <header
        className="flex items-center gap-2 px-3 border-b border-border flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        {/* Mobile back arrow */}
        <button
          type="button"
          onClick={closeTaskInspector}
          className="xl:hidden h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-[11px] text-muted-foreground truncate">
          {task.id}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={copyLink}
          className="h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Copy task link"
          title="Copy task link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="More actions"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-8 z-50 w-48 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setOpenFullEditor(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-muted text-left"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  Open full editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    handleDelete()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-destructive hover:bg-destructive/10 text-left border-t border-border"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete task
                </button>
              </div>
            </>
          )}
        </div>
        {/* Desktop close (mobile uses back chevron on the left) */}
        <button
          type="button"
          onClick={closeTaskInspector}
          className="hidden xl:flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close inspector"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-2 border-b border-border flex-shrink-0">
        {[
          { id: 'detail', label: 'Detail' },
          { id: 'activity', label: 'Activity' },
          { id: 'source', label: 'Source' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={
              'text-[11px] font-emphasis px-2.5 py-1.5 -mb-px border-b transition-colors ' +
              (activeTab === t.id
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4 min-w-0">
        {activeTab === 'detail' && (
          <>
            <div>
              <input
                ref={titleRef}
                type="text"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Task title…"
                className="w-full bg-transparent border-0 text-[16px] font-emphasis text-foreground leading-snug focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Field label="Status">
                <select
                  value={task.status || 'todo'}
                  onChange={e => setStatus(e.target.value)}
                  className="bg-transparent text-[12px] text-foreground border-0 focus:outline-none cursor-pointer hover:bg-muted rounded-sm px-1 py-0.5 -ml-1"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <StatusDot status={task.status} size={10} />
              </Field>
              <Field label="Priority">
                <select
                  value={task.priority || 'medium'}
                  onChange={e => setPriority(e.target.value)}
                  className="bg-transparent text-[12px] text-foreground border-0 focus:outline-none cursor-pointer hover:bg-muted rounded-sm px-1 py-0.5 -ml-1"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <PriorityChip priority={task.priority} />
              </Field>
              <Field label="Assignee">
                <span className="text-[12px] text-muted-foreground">
                  {task.assignees && task.assignees.length > 0
                    ? task.assignees.join(', ')
                    : task.assignee || 'Unassigned'}
                </span>
              </Field>
              <Field label="Due">
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={e => setDueDate(e.target.value)}
                  className="bg-transparent text-[12px] text-foreground border-0 focus:outline-none cursor-pointer hover:bg-muted rounded-sm px-1 py-0.5 -ml-1 font-mono"
                />
              </Field>
              <Field label="Project">
                <span className="text-[12px] text-muted-foreground">
                  {projectName}
                </span>
              </Field>
              {isAi && (
                <Field label="Source">
                  <AiBadge />
                  {task.meetingId && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('source')}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      View meeting
                    </button>
                  )}
                </Field>
              )}
            </div>

            {/* AI summary block — shown when task has aiMetadata.summary */}
            {task.aiMetadata?.summary && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AiBadge />
                  <span className="text-[10px] uppercase tracking-[0.04em] text-primary font-emphasis">
                    AI summary
                  </span>
                </div>
                <p className="font-serif text-[13px] text-foreground leading-snug">
                  {task.aiMetadata.summary}
                </p>
                {task.aiMetadata.source && (
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    {task.aiMetadata.source}
                  </p>
                )}
              </div>
            )}

            {/* Subtasks */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis mb-1.5">
                Subtasks
              </div>
              <div className="flex flex-col">
                {(task.subtasks || []).map((s, i) => (
                  <SubtaskRow
                    key={s.id || `${i}-${s.text}`}
                    subtask={s}
                    onToggle={() => toggleSubtask(i)}
                    onRemove={() => removeSubtask(i)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSubtask.trim()) {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                  placeholder="Add subtask…"
                  className="flex-1 bg-background border border-input rounded-sm px-2 py-1 text-[12px] text-foreground focus:outline-none focus:border-ring placeholder:text-muted-foreground"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addSubtask}
                  disabled={!newSubtask.trim()}
                  className="h-7 px-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis mb-1.5">
                Description
              </div>
              <textarea
                value={descriptionDraft}
                onChange={e => setDescriptionDraft(e.target.value)}
                onBlur={commitDescription}
                placeholder="Add a description, notes, or context…"
                rows={4}
                className="w-full bg-background border border-input rounded-sm px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-ring placeholder:text-muted-foreground resize-y"
              />
            </div>

            <div className="text-[10px] text-muted-foreground italic">
              Need comments, mentions, AI templates, or linked tasks? Use the{' '}
              <button
                type="button"
                onClick={() => setOpenFullEditor(true)}
                className="text-foreground underline-offset-2 hover:underline"
              >
                full editor
              </button>
              .
            </div>
          </>
        )}

        {activeTab === 'activity' && <ActivityList taskId={task.id} />}
        {activeTab === 'source' && <SourceTab task={task} />}
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-2 px-3 py-2 border-t border-border flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8"
          onClick={() => setOpenFullEditor(true)}
        >
          Comment
        </Button>
        <Button
          size="sm"
          className="flex-1 h-8"
          onClick={markDone}
        >
          {task.status === 'done' ? 'Reopen' : 'Mark Done'}
        </Button>
      </footer>

      {/* Escape-hatch full editor — opens the legacy TaskDetailModal with
          this same task so all power features (comments, mentions, AI
          templates, linked tasks) remain reachable until they migrate
          into the inspector in follow-up slices. */}
      <TaskDetailModal
        task={openFullEditor ? task : null}
        isOpen={openFullEditor}
        onClose={() => setOpenFullEditor(false)}
      />
    </div>
  )
}
