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
  Settings
} from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getShortId } from '../../lib/utils'
import useAppStore from '../../stores/useAppStore'

function NavItem({ icon: Icon, label, count, active = false, disabled = false, onClick, indent = false }) {
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
            (active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')
          }
          aria-hidden="true"
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {count != null && (
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
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
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
  const projects = useAppStore(state => state.projects)
  const currentProject = useAppStore(state => state.currentProject)
  const loadProject = useAppStore(state => state.loadProject)
  const clearCurrentProject = useAppStore(state => state.clearCurrentProject)
  const setSettingsOpen = useAppStore(state => state.setSettingsOpen)
  const addNotification = useAppStore(state => state.addNotification)
  const user = useAppStore(state => state.user)

  const goToDashboard = () => {
    clearCurrentProject()
    const params = new URLSearchParams(window.location.search)
    const tenant = params.get('tenant')
    navigate(tenant ? `/?tenant=${tenant}` : '/')
    onCloseMobile?.()
  }

  const goToProject = projectId => {
    loadProject(projectId)
    const params = new URLSearchParams(window.location.search)
    params.set('project', getShortId(projectId))
    navigate(`/?${params.toString()}`)
    onCloseMobile?.()
  }

  const comingSoon = label => () => {
    addNotification({
      type: 'info',
      message: `${label} view arrives in Slice 4 with the Tasks view + filters.`
    })
    onCloseMobile?.()
  }

  // Workspace label: use the user's email domain as a stand-in until we
  // model a real workspace entity. Matches the workspace_id we already
  // namespace localStorage by (currentProject.id).
  const workspaceLabel = (() => {
    if (!user) return 'Workspace'
    if (user.tenant_name) return user.tenant_name
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
          onClick={comingSoon('Inbox')}
        />
        <NavItem
          icon={Clock}
          label="Today"
          onClick={comingSoon('Today')}
        />
        <NavItem
          icon={Activity}
          label="Activity"
          onClick={comingSoon('Activity')}
        />
      </div>

      {/* Projects */}
      <div className="px-1.5 py-2 border-t border-border space-y-0.5">
        <NavEyebrow
          label="Projects"
          onAdd={() => {
            // Project create lives in the existing Header dropdown; for
            // now nudge users to use it. The dedicated "create workspace
            // entity" command lands in Slice 3 with the topbar wiring.
            addNotification({
              type: 'info',
              message:
                'Project create lives in the project selector for now. Coming to the sidebar in Slice 3.'
            })
          }}
        />
        <NavItem
          icon={Folder}
          label="Dashboard overview"
          active={!currentProject}
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
        <NavItem
          icon={Calendar}
          label="Recent"
          onClick={comingSoon('Recent meetings')}
        />
        <NavItem
          icon={Clock}
          label="Upcoming"
          onClick={comingSoon('Upcoming meetings')}
        />
      </div>

      {/* Footer: user card + settings */}
      <div className="mt-auto px-1.5 py-2 border-t border-border space-y-0.5">
        <NavItem
          icon={Settings}
          label="Settings"
          onClick={() => {
            setSettingsOpen(true)
            onCloseMobile?.()
          }}
        />
        {user && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted transition-colors text-left"
          >
            <span
              className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-primary-foreground text-[10px] font-emphasis flex-shrink-0"
              style={{
                background:
                  'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)'
              }}
              aria-hidden="true"
            >
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="text-[12px] font-emphasis text-foreground truncate">
                {user.name || user.email}
              </span>
              {user.email && user.name && (
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  {user.email}
                </span>
              )}
            </span>
          </button>
        )}
      </div>
    </aside>
  )
}
