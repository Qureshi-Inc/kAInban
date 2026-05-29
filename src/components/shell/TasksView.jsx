/*
 * TasksView — DESIGN.md v3.1.6.
 *
 * The Tasks (list) presentation of the current project's tasks. Groups
 * by status by default. Within each group, sorts by priority desc then
 * due date asc. Empty groups render an "Add task" affordance instead of
 * an empty state.
 *
 * Group state (collapsed / expanded) persists per user per workspace in
 * localStorage under `kainban:listGroups:<workspaceId>` as a JSON map
 * `{ statusValue: boolean }`. Default = all expanded.
 *
 * Keyboard:
 *   j / k       focus next / previous row (Slice 4)
 *   Enter / o   open the focused row in the inspector
 *   Esc         clear focus
 *
 * When the inspector is OPEN, the inspector's own j/k handler (Slice 3)
 * takes over — the list nav stays out of the way.
 */

import { ChevronRight, ChevronDown, Plus } from 'lucide-react'
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import useAppStore from '../../stores/useAppStore'
import TaskRow from './TaskRow'

const STATUS_GROUPS = [
  { value: 'todo', label: 'Inbox', dotClass: 'bg-muted-foreground' },
  { value: 'in-progress', label: 'In Progress', dotClass: 'bg-info' },
  { value: 'blocked', label: 'Blocked', dotClass: 'bg-destructive' },
  { value: 'done', label: 'Done', dotClass: 'bg-success' }
]

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 }

function sortRows(a, b) {
  // Priority desc
  const pa = PRIORITY_WEIGHT[a.priority] || 0
  const pb = PRIORITY_WEIGHT[b.priority] || 0
  if (pa !== pb) {
    return pb - pa
  }
  // Due date asc (nulls last)
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
  const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
  if (da !== db) {
    return da - db
  }
  // Stable fallback: created order (id is time-derived in this app)
  return (a.id || '').localeCompare(b.id || '')
}

function readGroupState(workspaceId) {
  try {
    const raw = localStorage.getItem(`kainban:listGroups:${workspaceId}`)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch (_e) {
    // Bad/missing state — default to all expanded.
  }
  return {}
}

function writeGroupState(workspaceId, state) {
  try {
    localStorage.setItem(
      `kainban:listGroups:${workspaceId}`,
      JSON.stringify(state)
    )
  } catch (_e) {
    // localStorage unavailable — collapse state stays in-memory only.
  }
}

function GroupHeader({ group, count, collapsed, onToggle, onAdd }) {
  return (
    <div className="group flex items-center gap-2 px-1.5 py-1.5 border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span
          className={`w-1.5 h-1.5 rounded-full ${group.dotClass}`}
          aria-hidden="true"
        />
        <span className="text-[11px] font-emphasis uppercase tracking-[0.04em] text-secondary-foreground">
          {group.label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </button>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onAdd}
        className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-sm hover:bg-muted"
      >
        <Plus className="h-3 w-3" />
        Add task
      </button>
    </div>
  )
}

/*
 * Accepts an optional `tasks` prop so the same view can render either
 * the current project's tasks (default) or a filtered cross-project
 * slice (e.g. the Sidebar's Inbox / Today destinations feed a flat list
 * of tasks pulled from store.projects[*].tasks). When `tasks` is passed,
 * the view doesn't subscribe to state.tasks at all.
 */
export default function TasksView({ tasks: tasksProp, emptyMessage } = {}) {
  const storeTasks = useAppStore(state => state.tasks)
  const tasks =
    tasksProp !== null && tasksProp !== undefined ? tasksProp : storeTasks
  const currentProject = useAppStore(state => state.currentProject)
  const currentTaskId = useAppStore(state => state.currentTaskId)
  const openTaskInspector = useAppStore(state => state.openTaskInspector)
  const addNotification = useAppStore(state => state.addNotification)
  const workspaceId = currentProject?.id || 'default'

  const [collapsed, setCollapsed] = useState(() => readGroupState(workspaceId))
  const [focusedId, setFocusedId] = useState(null)
  const rowsRef = useRef(new Map())

  // Reset focus + reload group state when the project changes.
  useEffect(() => {
    setCollapsed(readGroupState(workspaceId))
    setFocusedId(null)
  }, [workspaceId])

  // Group + sort the tasks once.
  const groups = useMemo(() => {
    const buckets = new Map(STATUS_GROUPS.map(g => [g.value, []]))
    for (const t of tasks) {
      const key = buckets.has(t.status) ? t.status : 'todo'
      buckets.get(key).push(t)
    }
    for (const arr of buckets.values()) {
      arr.sort(sortRows)
    }
    return STATUS_GROUPS.map(g => ({
      ...g,
      items: buckets.get(g.value) || []
    }))
  }, [tasks])

  // Ordered list of visible task IDs (respects collapsed state) for j/k nav.
  const visibleIds = useMemo(() => {
    const ids = []
    for (const g of groups) {
      if (collapsed[g.value]) {
        continue
      }
      for (const t of g.items) {
        ids.push(t.id)
      }
    }
    return ids
  }, [groups, collapsed])

  const toggleGroup = useCallback(
    value => {
      setCollapsed(prev => {
        const next = { ...prev, [value]: !prev[value] }
        writeGroupState(workspaceId, next)
        return next
      })
    },
    [workspaceId]
  )

  // Keyboard nav — only when inspector is closed (otherwise Slice 3's
  // inspector handler owns j/k). Skip when typing in an input.
  useEffect(() => {
    if (currentTaskId) {
      return
    } // Inspector handles j/k
    const onKey = e => {
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
        if (visibleIds.length === 0) {
          return
        }
        e.preventDefault()
        const idx = visibleIds.indexOf(focusedId)
        const nextIdx =
          idx < 0
            ? 0
            : e.key === 'j'
              ? Math.min(visibleIds.length - 1, idx + 1)
              : Math.max(0, idx - 1)
        const nextId = visibleIds[nextIdx]
        setFocusedId(nextId)
        // Scroll into view if needed
        const el = rowsRef.current.get(nextId)
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } else if (e.key === 'Enter' || e.key === 'o') {
        if (!focusedId) {
          return
        }
        e.preventDefault()
        openTaskInspector(focusedId)
      } else if (e.key === 'Escape') {
        setFocusedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTaskId, visibleIds, focusedId, openTaskInspector])

  // When invoked without an explicit tasks prop AND no project is
  // selected, there's nothing to render — the dashboard owns that slot.
  if ((tasksProp === null || tasksProp === undefined) && !currentProject) {
    return null
  }

  if (tasks.length === 0) {
    return (
      <div className="border border-border rounded-md bg-card p-12 text-center">
        <div className="text-[12px] text-muted-foreground">
          {emptyMessage ||
            'No tasks yet. Record a meeting, paste text, or add one manually.'}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-md bg-card overflow-hidden">
      {groups.map(g => (
        <div key={g.value}>
          <GroupHeader
            group={g}
            count={g.items.length}
            collapsed={Boolean(collapsed[g.value])}
            onToggle={() => toggleGroup(g.value)}
            onAdd={() =>
              addNotification({
                type: 'info',
                message:
                  'Inline-create row arrives with the inline-edit polish PR. For now, use the kanban "+ Add task" or the command palette.'
              })
            }
          />
          {!collapsed[g.value] && (
            <div className="py-0.5">
              {g.items.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-muted-foreground italic">
                  Nothing here.
                </div>
              ) : (
                g.items.map(t => (
                  <div
                    key={t.id}
                    ref={el => {
                      if (el) {
                        rowsRef.current.set(t.id, el)
                      } else {
                        rowsRef.current.delete(t.id)
                      }
                    }}
                  >
                    <TaskRow
                      task={t}
                      focused={focusedId === t.id}
                      onFocus={() => setFocusedId(t.id)}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
