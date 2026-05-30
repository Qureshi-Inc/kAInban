/*
 * Sidebar — v3.1.2 composition (DESIGN.md).
 *
 * Top-to-bottom:
 *   1. Workspace switcher (header, height = --topbar-h)
 *   2. Primary nav group: Inbox, Today, Activity
 *   3. Projects group (eyebrow + list with counts; tree expands later)
 *   4. Meetings group: Recent, Upcoming
 *   5. Footer: user card (avatar + name + email, opens user menu)
 *
 * Slice 2 wires the structure + real Project navigation. Inbox / Today /
 * Activity / Meetings destinations don't have dedicated routes yet (they
 * arrive with the TaskRow + filtering work in Slice 4), so those items
 * fire an info notification today. The structure ships now so we don't
 * have to re-decorate the sidebar later.
 *
 * Active-state rule: the project nav item with `id === currentProject.id`
 * gets the active treatment; nothing else does. That's intentional — only
 * one nav item is "where you are" at a time.
 */

import {
  Inbox,
  Clock,
  Activity,
  Folder,
  Calendar,
  Plus,
  ChevronDown,
  Settings,
  Command,
  BookOpen,
  LogOut
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getShortId } from '../../lib/utils'
import useAppStore from '../../stores/useAppStore'

/*
 * UserMenu — v3.1.2 sidebar footer popover.
 *
 * Replaces the previous "click avatar to open Settings" shortcut. SaaS-
 * standard menu: Profile header, Settings, Cmd-K, Docs, Sign out.
 * Strict v3.1 Workhorse Dark restraint: hairline border, no shadows
 * beyond the popover's elevation, all 11-12px text, mono for the email
 * and the role badge. Five actions max — Linear-grade discipline.
 *
 * Opens above the trigger because the trigger is at the bottom of the
 * sidebar; on mobile the sidebar is itself a drawer, so the popover
 * sits above the user card without clipping.
 */
function UserMenu({ user, onOpenSettings, onTogglePalette, onCloseMobile }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const logout = useAppStore(state => state.logout)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const onDoc = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  const handleSettings = () => {
    close()
    onCloseMobile?.()
    onOpenSettings()
  }

  const handlePalette = () => {
    close()
    onCloseMobile?.()
    onTogglePalette()
  }

  const handleDocs = () => {
    close()
    window.open(
      'https://github.com/Qureshi-Inc/kAInban#readme',
      '_blank',
      'noopener,noreferrer'
    )
  }

  const handleLogout = async () => {
    close()
    onCloseMobile?.()
    try {
      await logout()
    } catch (_e) {
      // logout() handles its own notifications; nothing to do here.
    }
  }

  const initial = (user.name || user.email || '?').charAt(0).toUpperCase()
  const role = user.role || 'member'
  // Mac vs everything else for the kbd hint. Honest, not a guess.
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
  const cmdSym = isMac ? '⌘' : 'Ctrl'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors text-left ' +
          (open ? 'bg-muted' : 'hover:bg-muted')
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-primary-foreground text-[10px] font-emphasis flex-shrink-0"
          style={{
            background:
              'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)'
          }}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="flex flex-col min-w-0 leading-tight flex-1">
          <span className="text-[12px] font-emphasis text-foreground truncate">
            {user.name || user.email}
          </span>
          {user.email && user.name && (
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {user.email}
            </span>
          )}
        </span>
        <ChevronDown
          className={
            'h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform ' +
            (open ? 'rotate-180' : '')
          }
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-1.5 z-30 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          role="menu"
        >
          {/* Profile header — name (Inter 510), email (mono), role chip */}
          <div className="px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 flex items-center justify-center rounded-full text-primary-foreground text-[12px] font-emphasis flex-shrink-0"
                style={{
                  background:
                    'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)'
                }}
                aria-hidden="true"
              >
                {initial}
              </span>
              <div className="flex flex-col min-w-0 leading-tight flex-1">
                <span className="text-[12px] font-emphasis text-foreground truncate">
                  {user.name || user.email}
                </span>
                {user.email && (
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    {user.email}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm border border-border bg-muted text-[9px] uppercase tracking-[0.06em] font-emphasis text-muted-foreground">
                {role}
              </span>
            </div>
          </div>

          {/* Action group */}
          <div className="py-1">
            <button
              type="button"
              onClick={handleSettings}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground hover:bg-muted text-left"
              role="menuitem"
            >
              <Settings
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">Settings</span>
            </button>
            <button
              type="button"
              onClick={handlePalette}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground hover:bg-muted text-left"
              role="menuitem"
            >
              <Command
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">Command palette</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {cmdSym} K
              </span>
            </button>
            <button
              type="button"
              onClick={handleDocs}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground hover:bg-muted text-left"
              role="menuitem"
            >
              <BookOpen
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">Documentation</span>
            </button>
          </div>

          {/* Sign out group — separated by hairline so it reads as the
              destructive bottom action, not just another menu item. */}
          <div className="py-1 border-t border-border">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/10 text-left"
              role="menuitem"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="flex-1">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  count,
  active = false,
  disabled = false,
  onClick,
  indent = false
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm ' +
        'text-[12px] font-emphasis transition-colors text-left ' +
        (indent ? 'pl-7 ' : '') +
        (active
          ? 'bg-secondary text-foreground '
          : 'text-muted-foreground hover:bg-muted hover:text-foreground ') +
        (disabled ? 'opacity-60 cursor-not-allowed ' : 'cursor-pointer ')
      }
    >
      {Icon && (
        <Icon
          className={
            'h-3.5 w-3.5 flex-shrink-0 ' +
            (active
              ? 'text-primary'
              : 'text-muted-foreground group-hover:text-foreground')
          }
          aria-hidden="true"
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {count !== null && count !== undefined && (
        <span
          className={
            'font-mono text-[10px] tabular-nums ' +
            (active ? 'text-secondary-foreground' : 'text-muted-foreground')
          }
        >
          {count}
        </span>
      )}
    </button>
  )
}

function NavEyebrow({ label, onAdd }) {
  return (
    <div className="group flex items-center justify-between px-2 pt-1 pb-1">
      <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-emphasis">
        {label}
      </span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label={`Add ${label.toLowerCase()}`}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default function Sidebar({ onCloseMobile }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projects = useAppStore(state => state.projects)
  const currentProject = useAppStore(state => state.currentProject)
  const meetings = useAppStore(state => state.meetings)
  const loadProject = useAppStore(state => state.loadProject)
  const clearCurrentProject = useAppStore(state => state.clearCurrentProject)
  const selectMeeting = useAppStore(state => state.selectMeeting)
  const setSettingsOpen = useAppStore(state => state.setSettingsOpen)
  const toggleCommandPalette = useAppStore(state => state.toggleCommandPalette)
  const setActivityPanelOpen = useAppStore(state => state.setActivityPanelOpen)
  const createProject = useAppStore(state => state.createProject)
  const addNotification = useAppStore(state => state.addNotification)
  const user = useAppStore(state => state.user)

  // Read the current view's filter mode so the Inbox/Today/Dashboard
  // items can highlight themselves when active.
  const activeFilter = searchParams.get('filter') || null

  const tenantParam = () => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tenant')
  }

  const goToDashboard = () => {
    clearCurrentProject()
    const tenant = tenantParam()
    navigate(tenant ? `/?tenant=${tenant}` : '/')
    onCloseMobile?.()
  }

  const goToProject = projectId => {
    loadProject(projectId)
    const params = new URLSearchParams(window.location.search)
    params.set('project', getShortId(projectId))
    params.delete('filter')
    navigate(`/?${params.toString()}`)
    onCloseMobile?.()
  }

  /*
   * Filter views — Inbox and Today route to a cross-project TasksView
   * rendered by MainView. Both clear `project` from the URL since they
   * span all projects. MainView reads ?filter=<name> and applies the
   * matching predicate over store.projects[*].tasks.
   */
  const goToFilter = name => () => {
    clearCurrentProject()
    const tenant = tenantParam()
    const params = new URLSearchParams()
    if (tenant) {
      params.set('tenant', tenant)
    }
    params.set('filter', name)
    navigate(`/?${params.toString()}`)
    onCloseMobile?.()
  }

  const openActivity = () => {
    setActivityPanelOpen(true)
    onCloseMobile?.()
  }

  /*
   * Recent meetings — jump to the most recently created meeting. Slice 4
   * lacks a dedicated "Meetings" route, so we navigate to the meeting's
   * parent project + select the meeting. The existing MainView wiring
   * surfaces it via the SummaryPanel / TranscriptPanel.
   */
  const goToRecentMeeting = () => {
    const pool = []
    for (const p of projects || []) {
      if (!p.meetings) {
        continue
      }
      for (const m of p.meetings) {
        pool.push({ ...m, _projectId: p.id })
      }
    }
    for (const m of meetings || []) {
      // Avoid duplicates if `meetings` already came from currentProject.
      if (!pool.find(x => x.id === m.id)) {
        pool.push({ ...m, _projectId: currentProject?.id })
      }
    }
    if (pool.length === 0) {
      addNotification({
        type: 'info',
        message: 'No meetings yet. Record one to see it here.'
      })
      onCloseMobile?.()
      return
    }
    pool.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
    const m = pool[0]
    if (!m._projectId) {
      addNotification({
        type: 'info',
        message: 'Most recent meeting has no project link.'
      })
      onCloseMobile?.()
      return
    }
    loadProject(m._projectId)
    selectMeeting(m.id)
    const params = new URLSearchParams()
    const tenant = tenantParam()
    if (tenant) {
      params.set('tenant', tenant)
    }
    params.set('project', getShortId(m._projectId))
    params.set('meeting', getShortId(m.id))
    navigate(`/?${params.toString()}`)
    onCloseMobile?.()
  }

  /*
   * Add new project — use a prompt() for now. A dedicated "Create
   * project" dialog used to live in the orphaned Header.jsx; that
   * dialog ports into a shared primitive in a polish PR. The prompt
   * here is honest about being temporary and gets users unblocked.
   */
  const handleAddProject = async () => {
    const name = window.prompt('Project name?')
    if (!name || !name.trim()) {
      onCloseMobile?.()
      return
    }
    try {
      const project = await createProject(name.trim())
      if (project?.id) {
        goToProject(project.id)
      }
      addNotification({
        type: 'success',
        message: `Project "${name.trim()}" created`
      })
    } catch (e) {
      addNotification({
        type: 'error',
        message: `Failed to create project: ${e.message || 'server error'}`
      })
    }
  }

  // Workspace label: use the user's email domain as a stand-in until we
  // model a real workspace entity. Matches the workspace_id we already
  // namespace localStorage by (currentProject.id).
  const workspaceLabel = (() => {
    if (!user) {
      return 'Workspace'
    }
    if (user.tenant_name) {
      return user.tenant_name
    }
    if (user.email) {
      const domain = user.email.split('@')[1]
      if (domain) {
        return domain.split('.')[0].replace(/\b\w/g, c => c.toUpperCase())
      }
    }
    return 'Personal'
  })()

  const workspaceGlyph = workspaceLabel.charAt(0).toUpperCase()

  return (
    <aside
      className="flex flex-col h-full bg-card border-r border-border text-card-foreground"
      data-shell-sidebar
    >
      {/* Workspace switcher (header) */}
      <div
        className="flex items-center px-2 border-b border-border"
        style={{ height: 'var(--topbar-h)' }}
      >
        <button
          type="button"
          onClick={goToDashboard}
          className="w-full flex items-center gap-2 px-1.5 py-1 rounded-sm hover:bg-muted transition-colors"
        >
          <span
            className="w-[22px] h-[22px] flex items-center justify-center rounded-sm bg-primary text-primary-foreground font-serif text-[14px] flex-shrink-0"
            aria-hidden="true"
          >
            {workspaceGlyph}
          </span>
          <span className="text-[12px] font-emphasis text-foreground truncate flex-1 text-left">
            {workspaceLabel}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Primary nav: Inbox / Today / Activity */}
      <div className="px-1.5 py-2 space-y-0.5">
        <NavItem
          icon={Inbox}
          label="Inbox"
          active={!currentProject && activeFilter === 'inbox'}
          onClick={goToFilter('inbox')}
        />
        <NavItem
          icon={Clock}
          label="Today"
          active={!currentProject && activeFilter === 'today'}
          onClick={goToFilter('today')}
        />
        <NavItem icon={Activity} label="Activity" onClick={openActivity} />
      </div>

      {/* Projects */}
      <div className="px-1.5 py-2 border-t border-border space-y-0.5">
        <NavEyebrow label="Projects" onAdd={handleAddProject} />
        <NavItem
          icon={Folder}
          label="Dashboard overview"
          active={!currentProject && !activeFilter}
          onClick={goToDashboard}
        />
        {projects.map(p => (
          <NavItem
            key={p.id}
            icon={Folder}
            label={p.name}
            count={p.tasks?.length ?? null}
            active={currentProject?.id === p.id}
            onClick={() => goToProject(p.id)}
          />
        ))}
        {projects.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-muted-foreground italic">
            No projects yet
          </div>
        )}
      </div>

      {/* Meetings */}
      <div className="px-1.5 py-2 border-t border-border space-y-0.5">
        <NavEyebrow label="Meetings" />
        <NavItem icon={Calendar} label="Recent" onClick={goToRecentMeeting} />
      </div>

      {/* Footer: user menu popover. The standalone "Settings" nav item
          was redundant once the user menu surfaced it; everything that
          used to live in the sidebar footer (settings, sign out) now
          lives inside the user popover, which is where SaaS users look
          for it. */}
      <div className="mt-auto px-1.5 py-2 border-t border-border">
        {user && (
          <UserMenu
            user={user}
            onOpenSettings={() => setSettingsOpen(true)}
            onTogglePalette={toggleCommandPalette}
            onCloseMobile={onCloseMobile}
          />
        )}
      </div>
    </aside>
  )
}
