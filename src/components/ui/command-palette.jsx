/*
 * CommandPalette — universal entry point per DESIGN.md v3.1.7.
 *
 * Single dialog that covers navigation, creation, AI actions, view switching,
 * and search. Triggered by Cmd+K / Ctrl+K from anywhere (global listener
 * lives in App.jsx and toggles `isCommandPaletteOpen` in the store).
 *
 * Library choice: cmdk (headless, ~3kb gzipped). Wrapped in Radix Dialog
 * (already in the project) for accessible portal + focus management.
 *
 * The visual contract is design-preview/shell.html and DESIGN.md v3.1.7 —
 * keep them in sync if you change anything here.
 *
 * Slice 1 scope: primitive + canonical action set wired to the existing
 * store/router. Search-results group (fuzzy task/meeting/project hits)
 * lands in Slice 2 alongside the AppShell migration.
 */

import { Command } from 'cmdk'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Search,
  Plus,
  Inbox,
  Clock,
  Activity,
  Folder,
  Calendar,
  LayoutGrid,
  List,
  Settings,
  Sparkles,
  FileText,
  Mic,
  LogOut,
  Sun,
  Moon
} from 'lucide-react'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getShortId } from '../../lib/utils'
import useAppStore from '../../stores/useAppStore'

/*
 * Tiny shortcut chip used in the right-aligned hint area for each item.
 * Matches the .kbd-sm pattern in shell.html. Kept inline rather than a
 * separate component since it's only used here.
 */
function Kbd({ children }) {
  return (
    <kbd className="font-mono text-[10px] leading-none px-[5px] py-[2px] rounded-sm bg-background text-secondary-foreground border border-border">
      {children}
    </kbd>
  )
}

/*
 * cmdk wraps every item in a focus-trapping list; we just style our group
 * containers + items. Active state comes via [data-selected="true"] from
 * cmdk. Non-active items remain neutral so the palette feels calm at rest.
 */
const itemClass =
  'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer text-[13px] text-foreground select-none ' +
  'data-[selected=true]:bg-secondary outline-none'

const itemIconClass =
  'h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-data-[selected=true]:text-foreground'

const groupLabelClass =
  'px-2.5 pt-1.5 pb-1 text-[10px] font-mono uppercase tracking-[0.06em] text-muted-foreground'

/*
 * Build the canonical action set per DESIGN.md v3.1.7. Actions are
 * declarative — each one knows its label, icon, group, optional shortcut
 * hint, and a `run()` closure. We construct them inside the component so
 * they capture the latest store/router refs without stale closure issues.
 */
function useActions({ close, navigate, theme, setTheme }) {
  const projects = useAppStore(state => state.projects)
  const currentProject = useAppStore(state => state.currentProject)
  const loadProject = useAppStore(state => state.loadProject)
  const clearCurrentProject = useAppStore(state => state.clearCurrentProject)
  const setSettingsOpen = useAppStore(state => state.setSettingsOpen)
  const setRecordingModalOpen = useAppStore(state => state.setRecordingModalOpen)
  const addNotification = useAppStore(state => state.addNotification)
  const clearSession = useAppStore(state => state.clearSession)
  const user = useAppStore(state => state.user)

  const goToDashboard = useCallback(() => {
    clearCurrentProject()
    const params = new URLSearchParams(window.location.search)
    const tenant = params.get('tenant')
    navigate(tenant ? `/?tenant=${tenant}` : '/')
  }, [clearCurrentProject, navigate])

  const goToProject = useCallback(
    (projectId) => {
      loadProject(projectId)
      const params = new URLSearchParams(window.location.search)
      params.set('project', getShortId(projectId))
      navigate(`/?${params.toString()}`)
    },
    [loadProject, navigate]
  )

  /*
   * Switch view persists per workspace as documented in DESIGN.md v3.1.5
   * and Slice 4 wires the actual canvas swap. We write the same key the
   * useViewMode hook reads AND fire a CustomEvent so any mounted
   * ViewSwitcher updates instantly without a reload.
   */
  const setViewMode = useCallback(
    (mode) => {
      const workspaceId = currentProject?.id || 'default'
      try {
        localStorage.setItem(`kainban:viewMode:${workspaceId}`, mode)
      } catch (_e) {
        // localStorage unavailable — same-tab dispatch still works below.
      }
      window.dispatchEvent(
        new CustomEvent('kainban:viewmode', {
          detail: { workspaceId, mode }
        })
      )
    },
    [currentProject?.id]
  )

  /*
   * AI actions are wired as notifications in Slice 1 so the entry points
   * exist now and we don't break the contract. The actual executions
   * (subtask generation, meeting summary, etc) hook up in Slice 3 alongside
   * the TaskInspector migration where most of these surfaces live.
   */
  const runAiAction = useCallback(
    (label) => {
      addNotification({
        type: 'info',
        message: `AI action "${label}" registered. Wires up in Slice 3 alongside the TaskInspector migration.`
      })
    },
    [addNotification]
  )

  const handleLogout = useCallback(async() => {
    try {
      await clearSession()
      navigate('/')
    } catch (e) {
      addNotification({ type: 'error', message: `Logout failed: ${e.message}` })
    }
  }, [clearSession, navigate, addNotification])

  return useMemo(
    () => [
      // ---- Suggested ----
      ...(currentProject
        ? [
            {
              id: 'sug-open-project',
              group: 'Suggested',
              label: `Open ${currentProject.name}`,
              icon: Folder,
              keywords: ['current', 'project'],
              run: () => goToProject(currentProject.id)
            }
          ]
        : [
            {
              id: 'sug-dashboard',
              group: 'Suggested',
              label: 'Dashboard overview',
              icon: Inbox,
              keywords: ['home', 'inbox', 'all'],
              run: goToDashboard
            }
          ]),
      {
        id: 'sug-record',
        group: 'Suggested',
        label: 'Record a meeting',
        icon: Mic,
        keywords: ['audio', 'capture', 'recording'],
        shortcut: ['R'],
        run: () => setRecordingModalOpen(true)
      },

      // ---- AI actions (canonical set per v3.1.7) ----
      {
        id: 'ai-subtasks',
        group: 'AI actions',
        label: 'Generate subtasks',
        icon: Sparkles,
        ai: true,
        keywords: ['ai', 'split', 'break', 'down'],
        run: () => runAiAction('Generate subtasks')
      },
      {
        id: 'ai-summarize',
        group: 'AI actions',
        label: 'Summarize meeting',
        icon: Sparkles,
        ai: true,
        keywords: ['ai', 'tldr', 'recap'],
        run: () => runAiAction('Summarize meeting')
      },
      {
        id: 'ai-extract',
        group: 'AI actions',
        label: 'Extract tasks from pasted text',
        icon: Sparkles,
        ai: true,
        keywords: ['ai', 'paste', 'transcript', 'notes'],
        run: () => runAiAction('Extract tasks from pasted text')
      },
      {
        id: 'ai-sprint',
        group: 'AI actions',
        label: 'Convert transcript → sprint plan',
        icon: Sparkles,
        ai: true,
        keywords: ['ai', 'plan', 'cycle'],
        run: () => runAiAction('Convert transcript → sprint plan')
      },
      {
        id: 'ai-blockers',
        group: 'AI actions',
        label: 'Find blockers across this project',
        icon: Sparkles,
        ai: true,
        keywords: ['ai', 'risks', 'stuck'],
        run: () => runAiAction('Find blockers across this project')
      },
      {
        id: 'ai-rerun',
        group: 'AI actions',
        label: 'Re-run AI analysis on this task',
        icon: Sparkles,
        ai: true,
        keywords: ['ai', 'retry', 'redo'],
        run: () => runAiAction('Re-run AI analysis on this task')
      },

      // ---- Create ----
      {
        id: 'create-task',
        group: 'Create',
        label: currentProject
          ? `New task in ${currentProject.name}`
          : 'New task (pick a project first)',
        icon: Plus,
        shortcut: ['C'],
        keywords: ['add', 'task'],
        disabled: !currentProject,
        run: () => {
          if (!currentProject) return
          addNotification({
            type: 'info',
            message:
              'New-task inline create lands in Slice 4 with the TaskRow primitive. Use the kanban "+ Add task" for now.'
          })
        }
      },

      // ---- Navigate ----
      {
        id: 'nav-dashboard',
        group: 'Navigate',
        label: 'Dashboard overview',
        icon: Inbox,
        shortcut: ['G', 'H'],
        keywords: ['home', 'inbox'],
        run: goToDashboard
      },
      ...projects.map(p => ({
        id: `nav-project-${p.id}`,
        group: 'Navigate',
        label: `Go to ${p.name}`,
        icon: Folder,
        keywords: ['project', 'open', p.name.toLowerCase()],
        run: () => goToProject(p.id)
      })),

      // ---- Switch view ----
      {
        id: 'view-kanban',
        group: 'Switch view',
        label: 'Switch to Kanban',
        icon: LayoutGrid,
        shortcut: ['V', 'B'],
        keywords: ['board', 'columns'],
        run: () => setViewMode('kanban')
      },
      {
        id: 'view-list',
        group: 'Switch view',
        label: 'Switch to Tasks',
        icon: List,
        shortcut: ['V', 'L'],
        keywords: ['rows', 'compact'],
        run: () => setViewMode('list')
      },

      // ---- Settings / Account ----
      {
        id: 'settings',
        group: 'Account',
        label: 'Open settings',
        icon: Settings,
        keywords: ['preferences', 'config', 'ai', 'api'],
        run: () => setSettingsOpen(true)
      },
      {
        id: 'theme',
        group: 'Account',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        icon: theme === 'dark' ? Sun : Moon,
        keywords: ['theme', 'dark', 'light', 'appearance'],
        run: () => setTheme(theme === 'dark' ? 'light' : 'dark')
      },
      ...(user
        ? [
            {
              id: 'logout',
              group: 'Account',
              label: 'Log out',
              icon: LogOut,
              keywords: ['signout', 'exit'],
              run: handleLogout
            }
          ]
        : [])
    ],
    [
      currentProject,
      projects,
      goToDashboard,
      goToProject,
      runAiAction,
      setRecordingModalOpen,
      setSettingsOpen,
      setViewMode,
      theme,
      setTheme,
      user,
      handleLogout,
      addNotification
    ]
  )
}

/*
 * Read/write theme via the same mechanism Header.jsx uses (HTML data-theme
 * + dark class + localStorage). Wrapped here so the palette can toggle
 * without coupling to Header internals.
 */
function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  const setTheme = useCallback((next) => {
    const html = document.documentElement
    if (next === 'dark') {
      html.classList.add('dark')
      html.setAttribute('data-theme', 'dark')
    } else {
      html.classList.remove('dark')
      html.setAttribute('data-theme', 'light')
    }
    try {
      localStorage.setItem('kainban-theme', next)
    } catch (_e) {
      // localStorage unavailable — toggle still works in-session.
    }
    setThemeState(next)
  }, [])

  return [theme, setTheme]
}

export default function CommandPalette() {
  const open = useAppStore(state => state.isCommandPaletteOpen)
  const setOpen = useAppStore(state => state.setCommandPaletteOpen)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useTheme()

  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [setOpen])

  const actions = useActions({ close, navigate, theme, setTheme })

  // Group actions for rendering. Preserve declaration order within groups,
  // and emit groups in the order they first appear (matches the v3.1.7
  // spec: Suggested -> AI actions -> Create -> Navigate -> Switch view ->
  // Account).
  const grouped = useMemo(() => {
    const order = []
    const map = new Map()
    for (const a of actions) {
      if (!map.has(a.group)) {
        map.set(a.group, [])
        order.push(a.group)
      }
      map.get(a.group).push(a)
    }
    return order.map(group => ({ group, items: map.get(group) }))
  }, [actions])

  const handleSelect = useCallback(
    (action) => {
      if (action.disabled) return
      close()
      // defer the actual action a tick so the palette unmounts cleanly
      // before navigation / modal opens fire (avoids focus-trap thrash).
      setTimeout(() => action.run(), 0)
    },
    [close]
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-[201] -translate-x-1/2 w-[560px] max-w-[calc(100vw-32px)] max-h-[60vh] bg-popover text-popover-foreground border border-input rounded-lg shadow-2xl overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <Command
            label="Command palette"
            shouldFilter={true}
            loop
            className="flex flex-col min-h-0"
          >
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <Command.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                placeholder="Type a command or search\u2026"
                className="flex-1 bg-transparent border-0 outline-none text-[14px] text-foreground placeholder:text-muted-foreground"
              />
              <kbd className="font-mono text-[10px] leading-none px-[6px] py-[2px] rounded-sm bg-background text-secondary-foreground border border-border">
                ESC
              </kbd>
            </div>

            <Command.List className="overflow-auto p-1 flex-1">
              <Command.Empty className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                No commands match{search ? ` "${search}"` : ''}.
              </Command.Empty>

              {grouped.map(({ group, items }) => (
                <Command.Group key={group} heading={null} className="py-1">
                  <div className={groupLabelClass}>{group}</div>
                  {items.map(action => {
                    const Icon = action.icon
                    return (
                      <Command.Item
                        key={action.id}
                        value={`${action.group} ${action.label} ${(action.keywords || []).join(' ')}`}
                        onSelect={() => handleSelect(action)}
                        disabled={action.disabled}
                        className={
                          itemClass +
                          (action.ai ? ' data-[selected=true]:text-primary' : '') +
                          (action.disabled ? ' opacity-50 cursor-not-allowed' : '')
                        }
                      >
                        <Icon
                          className={
                            itemIconClass +
                            (action.ai ? ' text-primary group-data-[selected=true]:text-primary' : '')
                          }
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate">{action.label}</span>
                        {action.shortcut && (
                          <span className="flex gap-1 flex-shrink-0">
                            {action.shortcut.map((key, i) => (
                              <Kbd key={i}>{key}</Kbd>
                            ))}
                          </span>
                        )}
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
