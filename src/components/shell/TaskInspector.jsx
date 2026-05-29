/*
 * TaskInspector — DESIGN.md v3.1.4 (Slice 5 — full parity).
 *
 * The right-side inspector. Replaces TaskDetailModal as the canonical
 * surface for reading/editing tasks across the entire app. Slice 3 shipped
 * the chrome + basic editing with an "Open full editor" escape; Slice 5
 * folds the remaining TaskDetailModal features into the inspector so the
 * escape goes away entirely:
 *
 *   - Inline server-backed comments with @mention dropdown
 *   - 5 AI content templates (Email / Document / Code / Research / Slack)
 *   - Per-subtask AI suggestion buttons (smart-detected from text)
 *   - "Add context" — AI re-evaluates the task given new info
 *   - Linked tasks tab with AI-suggested + manual links + search
 *   - Subtask → promote to standalone task
 *
 * Composition (matches the design preview):
 *
 *   ┌─────────────────────────────────┐
 *   │ TASK-ID    [link] [more] [×]    │  header (44px)
 *   ├─────────────────────────────────┤
 *   │ Detail · Activity · Linked · …  │  tabs
 *   ├─────────────────────────────────┤
 *   │ Title (editable)                │
 *   │ Field grid                      │
 *   │ AI summary                      │
 *   │ AI quick actions row            │
 *   │ Subtasks (each row has its own │
 *   │   AI-templates popover)         │
 *   │ Description                     │
 *   │ AI content panel (inline result │
 *   │   from any subtask's template)  │
 *   │ Comments + @mentions            │
 *   ├─────────────────────────────────┤
 *   │  Comment       Mark Done        │  footer
 *   └─────────────────────────────────┘
 */

import {
  X,
  Link as LinkIcon,
  MoreVertical,
  ChevronLeft,
  Trash2,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  Mail,
  FileText,
  Code,
  Search,
  MessageSquare,
  Copy,
  ChevronUp,
  ArrowUpRight,
  Unlink2
} from 'lucide-react'
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getShortId } from '../../lib/utils'
import apiService from '../../services/apiService'
import openaiService from '../../services/openaiService'
import useAppStore from '../../stores/useAppStore'
import { Button } from '../ui/button'

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do', dot: 'border-muted-foreground' },
  { value: 'in-progress', label: 'In progress', dot: 'bg-info border-info' },
  {
    value: 'blocked',
    label: 'Blocked',
    dot: 'bg-destructive border-destructive'
  },
  { value: 'done', label: 'Done', dot: 'bg-success border-success' }
]

const TEMPLATES = [
  { id: 'email', label: 'Email', icon: Mail, method: 'generateEmailTemplate' },
  {
    id: 'doc',
    label: 'Doc',
    icon: FileText,
    method: 'generateDocumentTemplate'
  },
  { id: 'code', label: 'Code', icon: Code, method: 'generateCodeTemplate' },
  {
    id: 'research',
    label: 'Research',
    icon: Search,
    method: 'generateResearchTemplate'
  },
  {
    id: 'slack',
    label: 'Message',
    icon: MessageSquare,
    method: 'generateSlackMessage'
  }
]

// Per-subtask AI suggestion — preserves the smart-detection UX from the
// legacy modal. If a subtask mentions an email or messaging verb, expose
// the relevant template generator inline beside it.
function detectSubtaskAi(text) {
  const lower = (text || '').toLowerCase()
  if (
    lower.includes('email') ||
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text || '')
  ) {
    return { template: 'email', icon: Mail, label: 'Draft email' }
  }
  const msgWords = [
    'notify',
    'ping',
    'reach out',
    'contact',
    'inform',
    'tell',
    'slack',
    'message',
    'dm',
    'chat'
  ]
  if (msgWords.some(w => lower.includes(w))) {
    return { template: 'slack', icon: MessageSquare, label: 'Draft message' }
  }
  return null
}

// ---------- presentational atoms ----------

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
  const label =
    priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Med'
  return (
    <span
      className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-emphasis ${tone}`}
    >
      {label}
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
      <div className="text-foreground flex items-center gap-1.5 min-w-0 flex-wrap">
        {children}
      </div>
    </div>
  )
}

// ---------- helpers ----------

function fmtRelative(ts) {
  if (!ts) {
    return ''
  }
  try {
    const d = new Date(ts)
    const now = Date.now()
    const diff = (now - d.getTime()) / 1000
    if (diff < 60) {
      return 'just now'
    }
    if (diff < 3600) {
      return `${Math.floor(diff / 60)}m ago`
    }
    if (diff < 86400) {
      return `${Math.floor(diff / 3600)}h ago`
    }
    if (diff < 86400 * 7) {
      return `${Math.floor(diff / 86400)}d ago`
    }
    return d.toLocaleDateString()
  } catch {
    return ''
  }
}

// Linkify @mentions so they render visually distinct without parsing HTML.
function renderCommentBody(text) {
  if (!text) {
    return null
  }
  const parts = text.split(/(@\w+(?:\s\w+)?)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-primary font-emphasis">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

// ---------- subtask row ----------

function SubtaskRow({
  subtask,
  onToggle,
  onRemove,
  onPromote,
  onGenerate,
  loadingTemplate
}) {
  // Auto-detect a relevant template from the subtask text. If nothing
  // matches (e.g. "Submit TPSA"), we render no AI button at all —
  // restraint per DESIGN.md v3.1 ("the accent appears at most ~3 times
  // per visible viewport — overuse kills the signal"). Only actionable
  // subtasks get an AI affordance, and they get it directly: one click,
  // one template, no popover.
  const detected = detectSubtaskAi(subtask.text)
  const isLoading = detected && loadingTemplate === detected.template

  return (
    <div className="group flex items-start gap-2 px-1 py-1 rounded-sm hover:bg-muted">
      <button
        type="button"
        onClick={onToggle}
        className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
        aria-label={subtask.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {subtask.completed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </button>
      <span
        className={`flex-1 text-[12px] break-words leading-relaxed ${
          subtask.completed
            ? 'text-muted-foreground line-through'
            : 'text-foreground'
        }`}
      >
        {subtask.text}
      </span>
      {detected && !subtask.completed && (
        <button
          type="button"
          onClick={() => onGenerate(detected.template, subtask.text)}
          disabled={isLoading}
          className="flex-shrink-0 mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-primary/40 bg-primary/5 text-primary text-[10px] font-emphasis hover:bg-primary/10 disabled:opacity-50"
          title={detected.label}
        >
          <Sparkles className="h-2.5 w-2.5" />
          {isLoading ? 'Generating…' : detected.label}
        </button>
      )}
      <button
        type="button"
        onClick={onPromote}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground mt-0.5"
        title="Promote to task"
      >
        <ArrowUpRight className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-0.5"
        aria-label="Remove subtask"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ---------- activity tab ----------

function ActivityList({ taskId, comments }) {
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
        if (!cancelled) {
          setChanges(Array.isArray(rows) ? rows : [])
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load activity')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  // Interleave changes + comments by timestamp so the user sees a single
  // chronological log.
  const merged = useMemo(() => {
    const items = []
    for (const c of changes) {
      items.push({ kind: 'change', at: c.created_at, payload: c })
    }
    for (const c of comments || []) {
      items.push({ kind: 'comment', at: c.created_at, payload: c })
    }
    items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    return items
  }, [changes, comments])

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
  if (merged.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground italic px-1 py-2">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {merged.map((m, i) => {
        if (m.kind === 'comment') {
          const c = m.payload
          return (
            <div
              key={`c-${c.id || i}`}
              className="grid grid-cols-[16px_1fr] gap-2 py-2 text-[12px] leading-snug"
            >
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full ml-[3px] bg-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-foreground font-emphasis">
                    {c.author_name || 'Someone'}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {fmtRelative(c.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-foreground whitespace-pre-wrap">
                  {renderCommentBody(c.content)}
                </p>
              </div>
            </div>
          )
        }
        const c = m.payload
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
            key={`a-${c.id || i}`}
            className="grid grid-cols-[16px_1fr] gap-2 py-1.5 text-[11px] leading-snug"
          >
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full ml-[3px] ${isAi ? 'bg-primary' : 'bg-muted-foreground'}`}
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
                {fmtRelative(c.created_at)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- source tab ----------

function SourceTab({ task }) {
  const meetings = useAppStore(state => state.meetings)
  const meeting = useMemo(() => {
    if (!task?.meetingId) {
      return null
    }
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
    </div>
  )
}

// ---------- linked tab ----------

function LinkedTab({ task }) {
  const tasks = useAppStore(state => state.tasks)
  const linkTasks = useAppStore(state => state.linkTasks)
  const unlinkTasks = useAppStore(state => state.unlinkTasks)
  const acceptAiSuggestion = useAppStore(state => state.acceptAiSuggestion)
  const rejectAiSuggestion = useAppStore(state => state.rejectAiSuggestion)
  const openTaskInspector = useAppStore(state => state.openTaskInspector)
  const addNotification = useAppStore(state => state.addNotification)
  const [query, setQuery] = useState('')

  const linkedIds = task.linkedTasks || []
  const aiCreated = task.aiCreatedLinks || []
  const aiDiscovered = task.aiDiscoveredLinks || []

  const linkedRows = useMemo(
    () => linkedIds.map(id => tasks.find(t => t.id === id)).filter(Boolean),
    [linkedIds, tasks]
  )
  const aiCreatedRows = useMemo(
    () => aiCreated.map(id => tasks.find(t => t.id === id)).filter(Boolean),
    [aiCreated, tasks]
  )
  const aiDiscoveredRows = useMemo(
    () => aiDiscovered.map(id => tasks.find(t => t.id === id)).filter(Boolean),
    [aiDiscovered, tasks]
  )

  const available = useMemo(() => {
    if (!query.trim()) {
      return []
    }
    const q = query.trim().toLowerCase()
    return tasks
      .filter(
        t =>
          t.id !== task.id &&
          !linkedIds.includes(t.id) &&
          !aiCreated.includes(t.id) &&
          !aiDiscovered.includes(t.id) &&
          (t.title.toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [query, tasks, task.id, linkedIds, aiCreated, aiDiscovered])

  const handleLink = toId => {
    linkTasks(task.id, [...linkedIds, toId])
    setQuery('')
    addNotification({ type: 'success', message: 'Task linked' })
  }

  const handleUnlink = toId => {
    unlinkTasks(task.id, toId)
    addNotification({ type: 'success', message: 'Task unlinked' })
  }

  const aiSuggestions = [
    ...aiCreatedRows.map(t => ({ task: t, kind: 'created' })),
    ...aiDiscoveredRows.map(t => ({ task: t, kind: 'discovered' }))
  ]

  return (
    <div className="space-y-4">
      {/* AI suggestions */}
      {aiSuggestions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis mb-1.5 flex items-center gap-1.5">
            <AiBadge /> Suggested links
          </div>
          <div className="space-y-1">
            {aiSuggestions.map(({ task: t, kind }) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm border border-primary/30 bg-primary/5"
              >
                <button
                  type="button"
                  onClick={() => openTaskInspector(t.id)}
                  className="flex-1 text-left text-[12px] text-foreground truncate hover:underline underline-offset-2"
                >
                  {t.title || 'Untitled'}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    acceptAiSuggestion(task.id, t.id, kind)
                    addNotification({ type: 'success', message: 'Linked' })
                  }}
                  className="h-6 px-2 text-[11px]"
                >
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    rejectAiSuggestion(task.id, t.id, kind)
                    addNotification({ type: 'info', message: 'Dismissed' })
                  }}
                  className="h-6 px-2 text-[11px] text-muted-foreground"
                >
                  Skip
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current links */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis mb-1.5">
          Linked tasks
        </div>
        {linkedRows.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">
            No linked tasks.
          </div>
        ) : (
          <div className="space-y-1">
            {linkedRows.map(t => (
              <div
                key={t.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-sm border border-border hover:bg-muted"
              >
                <StatusDot status={t.status} size={10} />
                <button
                  type="button"
                  onClick={() => openTaskInspector(t.id)}
                  className="flex-1 text-left text-[12px] text-foreground truncate hover:underline underline-offset-2"
                >
                  {t.title || 'Untitled'}
                </button>
                <button
                  type="button"
                  onClick={() => handleUnlink(t.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  aria-label="Unlink"
                  title="Unlink"
                >
                  <Unlink2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add link */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis mb-1.5">
          Link another task
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search this project's tasks…"
          className="w-full bg-background border border-input rounded-sm px-2 py-1 text-[12px] text-foreground focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        {query.trim() && (
          <div className="mt-1 border border-border rounded-sm bg-popover overflow-hidden">
            {available.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
                No matches.
              </div>
            ) : (
              available.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleLink(t.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[12px] hover:bg-muted"
                >
                  <StatusDot status={t.status} size={10} />
                  <span className="flex-1 truncate text-foreground">
                    {t.title || 'Untitled'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- main component ----------

export default function TaskInspector() {
  const currentTaskId = useAppStore(state => state.currentTaskId)
  const closeTaskInspector = useAppStore(state => state.closeTaskInspector)
  const openTaskInspector = useAppStore(state => state.openTaskInspector)
  const tasks = useAppStore(state => state.tasks)
  const currentProject = useAppStore(state => state.currentProject)
  const updateTask = useAppStore(state => state.updateTask)
  const deleteTask = useAppStore(state => state.deleteTask)
  const createTask = useAppStore(state => state.createTask)
  const addNotification = useAppStore(state => state.addNotification)
  const [searchParams] = useSearchParams()

  // Draft state — committed on blur. Avoids per-keystroke fan-out to the
  // debounced backend save.
  const [titleDraft, setTitleDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [activeTab, setActiveTab] = useState('detail')
  const [menuOpen, setMenuOpen] = useState(false)

  // Server-backed comments + users for @mentions.
  const [serverComments, setServerComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [users, setUsers] = useState([])
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 })
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0)

  // AI state.
  const [loadingAiAction, setLoadingAiAction] = useState(null) // 'email' | 'doc' | etc | 'context'
  const [aiContent, setAiContent] = useState(null) // { title, content, template }
  const [contextDraft, setContextDraft] = useState('')
  const [contextOpen, setContextOpen] = useState(false)

  const titleRef = useRef(null)
  const commentRef = useRef(null)

  // URL sync on mount — same as before.
  useEffect(() => {
    const urlTaskId = searchParams.get('task')
    if (urlTaskId && !currentTaskId) {
      openTaskInspector(urlTaskId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('task')])

  const task = useMemo(
    () => (currentTaskId ? tasks.find(t => t.id === currentTaskId) : null),
    [tasks, currentTaskId]
  )

  // Reset drafts + side state when the task switches.
  useEffect(() => {
    setTitleDraft(task?.title || '')
    setDescriptionDraft(task?.description || '')
    setNewSubtask('')
    setActiveTab('detail')
    setMenuOpen(false)
    setAiContent(null)
    setContextOpen(false)
    setContextDraft('')
    setNewComment('')
    setShowMentionDropdown(false)
    setServerComments([])
    // Auto-focus the title input when a brand-new untitled task opens —
    // that's the new "create task" flow (no separate modal).
    if (task && !task.title) {
      // schedule after render
      setTimeout(() => titleRef.current?.focus(), 0)
    }
  }, [task?.id])

  // Load comments + users when the inspector opens with a real task.
  useEffect(() => {
    if (!task?.id) {
      return
    }
    let cancelled = false
    apiService
      .getTaskComments(task.id)
      .then(rows => {
        if (!cancelled) {
          setServerComments(Array.isArray(rows) ? rows : [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerComments([])
        }
      })
    apiService
      .getUsers()
      .then(rows => {
        if (!cancelled) {
          setUsers(Array.isArray(rows) ? rows : [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [task?.id])

  // Keyboard: Esc closes, j/k navigates between tasks. Same as Slice 3,
  // unchanged.
  useEffect(() => {
    if (!currentTaskId) {
      return
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        if (showMentionDropdown) {
          setShowMentionDropdown(false)
          return
        }
        closeTaskInspector()
        return
      }
      const tag = (e.target?.tagName || '').toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        e.target?.isContentEditable
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return
      }
      if (e.key === 'j' || e.key === 'k') {
        const ids = tasks.map(t => t.id)
        const idx = ids.indexOf(currentTaskId)
        if (idx < 0) {
          return
        }
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
  }, [
    currentTaskId,
    tasks,
    closeTaskInspector,
    openTaskInspector,
    showMentionDropdown
  ])

  // ---- mutators ----

  const commitTitle = () => {
    if (!task) {
      return
    }
    const t = titleDraft.trim()
    if (t === task.title) {
      return
    }
    // Empty title is OK for brand-new tasks; we just don't blank an
    // existing non-empty title back to ''.
    if (!t && task.title) {
      return
    }
    updateTask(task.id, { title: t })
  }
  const commitDescription = () => {
    if (!task) {
      return
    }
    if ((descriptionDraft || '') === (task.description || '')) {
      return
    }
    updateTask(task.id, { description: descriptionDraft })
  }
  const setStatus = status =>
    task && status !== task.status && updateTask(task.id, { status })
  const setPriority = priority =>
    task && priority !== task.priority && updateTask(task.id, { priority })
  const setDueDate = dueDate =>
    task &&
    dueDate !== (task.dueDate || '') &&
    updateTask(task.id, { dueDate: dueDate || null })

  const toggleSubtask = idx => {
    if (!task) {
      return
    }
    const next = [...(task.subtasks || [])]
    if (!next[idx]) {
      return
    }
    next[idx] = { ...next[idx], completed: !next[idx].completed }
    updateTask(task.id, { subtasks: next })
  }
  const removeSubtask = idx => {
    if (!task) {
      return
    }
    const next = [...(task.subtasks || [])]
    next.splice(idx, 1)
    updateTask(task.id, { subtasks: next })
  }
  const addSubtaskRow = () => {
    if (!task || !newSubtask.trim()) {
      return
    }
    const next = [...(task.subtasks || [])]
    next.push({
      id: `subtask-${Date.now()}`,
      text: newSubtask.trim(),
      completed: false
    })
    updateTask(task.id, { subtasks: next })
    setNewSubtask('')
  }
  const promoteSubtask = subtask => {
    const created = createTask({
      title: subtask.text,
      description: `Promoted from subtask of "${task.title || task.id}"`,
      priority: task.priority || 'medium',
      linkedTasks: [task.id]
    })
    if (created?.id) {
      addNotification({
        type: 'success',
        message: `Created task "${subtask.text}"`
      })
    }
  }

  const markDone = () => {
    if (!task) {
      return
    }
    setStatus(task.status === 'done' ? 'todo' : 'done')
  }

  const handleDelete = async () => {
    if (!task) {
      return
    }
    if (!confirm(`Delete task "${task.title || task.id}"?`)) {
      return
    }
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
    if (!task) {
      return
    }
    const projectShort = currentProject ? getShortId(currentProject.id) : null
    const params = new URLSearchParams()
    if (projectShort) {
      params.set('project', projectShort)
    }
    params.set('task', task.id)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      addNotification({ type: 'success', message: 'Task link copied' })
    } catch {
      addNotification({ type: 'info', message: `Copy: ${url}` })
    }
  }

  // ---- AI actions ----

  const runTemplate = async (templateId, contextText) => {
    if (!task) {
      return
    }
    const def = TEMPLATES.find(t => t.id === templateId)
    if (!def) {
      return
    }
    setLoadingAiAction(templateId)
    setAiContent(null)
    try {
      const ctx = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status
      }
      const result = await openaiService[def.method](
        ctx,
        contextText || task.title || ''
      )
      setAiContent({
        title: `AI ${def.label}`,
        content: result,
        template: templateId
      })
    } catch (e) {
      addNotification({
        type: 'error',
        message: `${def.label} generation failed: ${e.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const generateSubtasks = async () => {
    if (!task) {
      return
    }
    setLoadingAiAction('subtasks')
    try {
      const ctx = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignees: task.assignees || [],
        dueDate: task.dueDate,
        subtasks: (task.subtasks || []).map(s => ({
          text: s.text,
          completed: s.completed
        }))
      }
      const updated = await openaiService.updateTaskWithContext(
        ctx,
        'Generate 3-6 concrete, actionable subtasks. Keep existing subtasks if any.'
      )
      if (updated.subtasks && Array.isArray(updated.subtasks)) {
        const merged = updated.subtasks.map((text, i) => ({
          id: task.subtasks?.[i]?.id || `subtask-${Date.now()}-${i}`,
          text,
          completed: task.subtasks?.[i]?.completed || false
        }))
        updateTask(task.id, { subtasks: merged })
        addNotification({
          type: 'success',
          message: `Generated ${merged.length} subtasks`
        })
      } else {
        addNotification({
          type: 'info',
          message: 'AI returned no new subtasks'
        })
      }
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Subtask generation failed: ${e.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  const applyContext = async () => {
    if (!task || !contextDraft.trim()) {
      return
    }
    setLoadingAiAction('context')
    try {
      const ctx = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignees: task.assignees || [],
        dueDate: task.dueDate,
        subtasks: (task.subtasks || []).map(s => ({
          text: s.text,
          completed: s.completed
        }))
      }
      const updated = await openaiService.updateTaskWithContext(
        ctx,
        contextDraft.trim()
      )
      const patch = {}
      if (updated.title && updated.title !== task.title) {
        patch.title = updated.title
      }
      if (updated.description && updated.description !== task.description) {
        patch.description = updated.description
      }
      if (updated.priority && updated.priority !== task.priority) {
        patch.priority = updated.priority
      }
      if (updated.status && updated.status !== task.status) {
        patch.status = updated.status
      }
      if (updated.dueDate && updated.dueDate !== task.dueDate) {
        patch.dueDate = updated.dueDate
      }
      if (Array.isArray(updated.assignees)) {
        patch.assignees = updated.assignees
      }
      if (Array.isArray(updated.subtasks)) {
        patch.subtasks = updated.subtasks.map((text, i) => ({
          id: task.subtasks?.[i]?.id || `subtask-${Date.now()}-${i}`,
          text,
          completed: task.subtasks?.[i]?.completed || false
        }))
      }
      if (Object.keys(patch).length > 0) {
        updateTask(task.id, patch)
        setTitleDraft(patch.title || task.title || '')
        setDescriptionDraft(patch.description ?? task.description ?? '')
        addNotification({
          type: 'success',
          message: `Task updated (${Object.keys(patch).length} fields changed)`
        })
      } else {
        addNotification({ type: 'info', message: 'AI suggested no changes' })
      }
      setContextDraft('')
      setContextOpen(false)
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Context update failed: ${e.message}`
      })
    } finally {
      setLoadingAiAction(null)
    }
  }

  // ---- comments + @mentions ----

  const handleCommentChange = e => {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setNewComment(value)
    const before = value.substring(0, cursor)
    const atIdx = before.lastIndexOf('@')
    if (atIdx !== -1) {
      const afterAt = before.substring(atIdx + 1)
      if (/^\w*$/.test(afterAt) && cursor - atIdx <= 20) {
        setMentionQuery(afterAt.toLowerCase())
        setMentionPosition({ start: atIdx, end: cursor })
        setShowMentionDropdown(true)
        setSelectedMentionIdx(0)
        return
      }
    }
    setShowMentionDropdown(false)
  }

  const filteredMentionUsers = useMemo(() => {
    if (!showMentionDropdown) {
      return []
    }
    const q = mentionQuery
    return users
      .filter(
        u =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
      )
      .slice(0, 6)
  }, [showMentionDropdown, mentionQuery, users])

  const insertMention = useCallback(
    user => {
      const before = newComment.substring(0, mentionPosition.start)
      const after = newComment.substring(mentionPosition.end)
      const next = `${before}@${user.name}${after}`
      setNewComment(next)
      setShowMentionDropdown(false)
      setTimeout(() => commentRef.current?.focus(), 0)
    },
    [newComment, mentionPosition]
  )

  const handleCommentKeyDown = e => {
    if (showMentionDropdown && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIdx(i => (i + 1) % filteredMentionUsers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIdx(
          i =>
            (i - 1 + filteredMentionUsers.length) % filteredMentionUsers.length
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMentionUsers[selectedMentionIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionDropdown(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault()
      submitComment()
    }
  }

  const submitComment = async () => {
    if (!newComment.trim() || !task) {
      return
    }
    try {
      const result = await apiService.addTaskComment(
        task.id,
        newComment.trim(),
        'user'
      )
      if (result?.success) {
        setNewComment('')
        // Reload comments.
        const rows = await apiService.getTaskComments(task.id)
        setServerComments(Array.isArray(rows) ? rows : [])
      } else {
        throw new Error(result?.error || 'Server rejected comment')
      }
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Failed to post comment: ${e.message}`
      })
    }
  }

  const copyAiContent = async () => {
    if (!aiContent?.content) {
      return
    }
    try {
      await navigator.clipboard.writeText(aiContent.content)
      addNotification({ type: 'success', message: 'Copied to clipboard' })
    } catch {
      addNotification({
        type: 'info',
        message: 'Clipboard unavailable — select the text manually'
      })
    }
  }
  const applyAiContentToDescription = () => {
    if (!aiContent?.content || !task) {
      return
    }
    const merged =
      (descriptionDraft ? descriptionDraft + '\n\n' : '') + aiContent.content
    setDescriptionDraft(merged)
    updateTask(task.id, { description: merged })
    setAiContent(null)
    addNotification({ type: 'success', message: 'Appended to description' })
  }

  // ---- render ----

  if (!task) {
    if (!currentTaskId) {
      return null
    }
    return (
      <div className="flex flex-col h-full p-6 text-center">
        <div className="m-auto max-w-[240px]">
          <p className="text-[12px] text-muted-foreground">
            Task not found. It may have been deleted or you may not have access.
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

  const hasLinks =
    (task.linkedTasks?.length || 0) +
      (task.aiCreatedLinks?.length || 0) +
      (task.aiDiscoveredLinks?.length || 0) >
    0

  const tabs = [
    { id: 'detail', label: 'Detail' },
    { id: 'activity', label: 'Activity' },
    {
      id: 'linked',
      label: hasLinks
        ? `Linked · ${(task.linkedTasks?.length || 0) + (task.aiCreatedLinks?.length || 0) + (task.aiDiscoveredLinks?.length || 0)}`
        : 'Linked'
    },
    ...(task.meetingId ? [{ id: 'source', label: 'Source' }] : [])
  ]

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* Header */}
      <header
        className="flex items-center gap-2 px-3 border-b border-border flex-shrink-0"
        style={{ height: 'var(--topbar-h)' }}
      >
        <button
          type="button"
          onClick={closeTaskInspector}
          className="xl:hidden h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-[11px] text-muted-foreground truncate">
          {task.id?.slice(0, 12) || 'new'}
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
                    handleDelete()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-destructive hover:bg-destructive/10 text-left"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete task
                </button>
              </div>
            </>
          )}
        </div>
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
        {tabs.map(t => (
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

            {/* AI summary (existing) */}
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

            {/* AI quick actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={generateSubtasks}
                disabled={loadingAiAction === 'subtasks'}
                className="h-7 px-2 text-[11px] gap-1 text-primary border-primary/40 hover:bg-primary/10"
              >
                <Sparkles className="h-3 w-3" />
                {loadingAiAction === 'subtasks'
                  ? 'Generating…'
                  : 'Generate subtasks'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContextOpen(o => !o)}
                className="h-7 px-2 text-[11px] gap-1 text-primary border-primary/40 hover:bg-primary/10"
              >
                <Sparkles className="h-3 w-3" />
                Add context
              </Button>
            </div>

            {/* Context update panel */}
            {contextOpen && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-2">
                <textarea
                  value={contextDraft}
                  onChange={e => setContextDraft(e.target.value)}
                  placeholder="What's new? e.g. 'Customer escalated this, push to high priority'"
                  rows={3}
                  className="w-full bg-background border border-input rounded-sm px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-ring placeholder:text-muted-foreground resize-y"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setContextOpen(false)
                      setContextDraft('')
                    }}
                    className="h-7 px-2 text-[11px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyContext}
                    disabled={
                      !contextDraft.trim() || loadingAiAction === 'context'
                    }
                    className="h-7 px-2 text-[11px] gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    {loadingAiAction === 'context' ? 'Applying…' : 'Apply'}
                  </Button>
                </div>
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
                    onPromote={() => promoteSubtask(s)}
                    onGenerate={(template, text) => runTemplate(template, text)}
                    loadingTemplate={loadingAiAction}
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
                      addSubtaskRow()
                    }
                  }}
                  placeholder="Add subtask…"
                  className="flex-1 bg-background border border-input rounded-sm px-2 py-1 text-[12px] text-foreground focus:outline-none focus:border-ring placeholder:text-muted-foreground"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addSubtaskRow}
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

            {/* AI templates row removed: templates now live as a
                per-subtask popover (sparkle button on each subtask
                row). Generating against the task title was the wrong
                scope — if a task has multiple subtasks each needing
                different templates, it's ambiguous what the global
                button should do. The popover scopes generation to
                the subtask's own text. */}

            {/* AI content panel (inline result) */}
            {aiContent && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <AiBadge />
                  <span className="text-[11px] font-emphasis text-foreground">
                    {aiContent.title}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setAiContent(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
                <pre className="text-[12px] text-foreground whitespace-pre-wrap font-sans leading-relaxed bg-background rounded-sm p-2 border border-border max-h-72 overflow-auto">
                  {aiContent.content}
                </pre>
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAiContent}
                    className="h-7 px-2 text-[11px] gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyAiContentToDescription}
                    className="h-7 px-2 text-[11px]"
                  >
                    Append to description
                  </Button>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis mb-1.5">
                Comments{' '}
                {serverComments.length > 0 && (
                  <span className="font-mono text-muted-foreground/70">
                    · {serverComments.length}
                  </span>
                )}
              </div>
              <div className="space-y-2 mb-2">
                {serverComments.map(c => (
                  <div
                    key={c.id}
                    className="rounded-sm border border-border bg-background p-2"
                  >
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[11px] font-emphasis text-foreground">
                        {c.author_name || 'Someone'}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {fmtRelative(c.created_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-foreground whitespace-pre-wrap leading-snug">
                      {renderCommentBody(c.content)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="relative">
                <textarea
                  ref={commentRef}
                  value={newComment}
                  onChange={handleCommentChange}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Comment… (Enter to send · @ to mention)"
                  rows={2}
                  className="w-full bg-background border border-input rounded-sm px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-ring placeholder:text-muted-foreground resize-y"
                />
                {showMentionDropdown && filteredMentionUsers.length > 0 && (
                  <div className="absolute left-0 bottom-full mb-1 w-full max-w-xs bg-popover border border-border rounded-md shadow-lg overflow-hidden z-10">
                    {filteredMentionUsers.map((u, i) => (
                      <button
                        key={u.id || u.email || i}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault()
                          insertMention(u)
                        }}
                        className={
                          'w-full flex items-center gap-2 px-2 py-1.5 text-left text-[12px] ' +
                          (i === selectedMentionIdx
                            ? 'bg-secondary text-foreground'
                            : 'text-foreground hover:bg-muted')
                        }
                      >
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-emphasis">
                          {(u.name || u.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 truncate">
                          {u.name || u.email}
                        </span>
                        {u.email && u.name && (
                          <span className="font-mono text-[10px] text-muted-foreground truncate">
                            {u.email}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'activity' && (
          <ActivityList taskId={task.id} comments={serverComments} />
        )}
        {activeTab === 'linked' && <LinkedTab task={task} />}
        {activeTab === 'source' && <SourceTab task={task} />}
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-2 px-3 py-2 border-t border-border flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8"
          onClick={() => {
            setActiveTab('detail')
            setTimeout(() => commentRef.current?.focus(), 0)
          }}
        >
          Comment
        </Button>
        <Button size="sm" className="flex-1 h-8" onClick={markDone}>
          {task.status === 'done' ? 'Reopen' : 'Mark Done'}
        </Button>
      </footer>
    </div>
  )
}
