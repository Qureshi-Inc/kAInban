/*
 * TopBar — v3.1.3 composition (DESIGN.md).
 *
 * Layout:
 *   [hamburger (mobile)] [breadcrumb] ... [palette trigger] [AI menu] [bell] [presence]
 *
 * Height fixed at var(--topbar-h) = 44px. Hairline bottom border.
 * Background: --bg-raised (matches the sidebar header so the visual rule
 * runs straight across).
 *
 * The palette trigger is the dominant visual element on purpose — it
 * telegraphs that the product is keyboard-first. Clicking it dispatches
 * the same store action as Cmd+K (toggleCommandPalette from Slice 1).
 */

import {
  Menu,
  Search,
  Sparkles,
  Bell,
  Sun,
  Moon
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'

function Kbd({ children }) {
  return (
    <kbd className="font-mono text-[10px] leading-none px-[5px] py-[2px] rounded-sm bg-background text-secondary-foreground border border-border">
      {children}
    </kbd>
  )
}

function IconBtn({ icon: Icon, label, onClick, badge = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {badge && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-destructive" />
      )}
    </button>
  )
}

/*
 * Theme toggle uses the same mechanism the existing Header.jsx + the
 * command palette use: html class + data-theme + kainban-theme localStorage.
 * Lift this into a shared hook in Slice 4 if a third consumer shows up.
 */
function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  useEffect(() => {
    // Sync if some other surface (palette, Header during transition)
    // mutated the document state.
    const observer = new MutationObserver(() => {
      const next = document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
      setThemeState(prev => (prev === next ? prev : next))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
    return () => observer.disconnect()
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
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
  }

  return [theme, toggle]
}

export default function TopBar({ onToggleSidebarMobile, onShowActivity }) {
  const currentProject = useAppStore(state => state.currentProject)
  const toggleCommandPalette = useAppStore(state => state.toggleCommandPalette)
  const addNotification = useAppStore(state => state.addNotification)
  const [theme, toggleTheme] = useTheme()

  const breadcrumb = currentProject
    ? { project: currentProject.name, view: 'Tasks', count: currentProject.tasks?.length ?? 0 }
    : { project: 'Workspace', view: 'Dashboard', count: null }

  return (
    <header
      className="flex items-center gap-2 px-2 sm:px-3 border-b border-border bg-card text-card-foreground"
      style={{ height: 'var(--topbar-h)' }}
      data-shell-topbar
    >
      {/* Mobile-only hamburger (sidebar is a drawer below 960px) */}
      <button
        type="button"
        onClick={onToggleSidebarMobile}
        aria-label="Open menu"
        className="md:hidden h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Menu className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground min-w-0">
        <span className="truncate">{breadcrumb.project}</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="text-foreground font-emphasis truncate">
          {breadcrumb.view}
        </span>
        {breadcrumb.count != null && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground ml-0.5">
            {breadcrumb.count}
          </span>
        )}
      </div>

      <span className="flex-1" />

      {/* Palette trigger — the dominant visual element of the topbar */}
      <button
        type="button"
        onClick={toggleCommandPalette}
        className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-sm bg-muted text-muted-foreground border border-input hover:border-ring transition-colors min-w-[220px] max-w-[360px]"
        aria-label="Open command palette"
      >
        <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <span className="text-[12px] flex-1 text-left truncate">
          Search tasks, projects, or ask AI…
        </span>
        <span className="flex gap-1 flex-shrink-0">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      {/* Mobile palette trigger — icon only */}
      <button
        type="button"
        onClick={toggleCommandPalette}
        className="sm:hidden h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {/* AI menu — opens the palette pre-filtered to AI actions group in
          Slice 3. For now, just opens the palette (cmdk's fuzzy filter
          surfaces AI actions immediately if user types "ai"). */}
      <IconBtn
        icon={Sparkles}
        label="AI actions"
        onClick={() => {
          toggleCommandPalette()
          // Notification gently guides user; harmless if palette is already
          // primed.
          addNotification({
            type: 'info',
            message: 'Type "ai" in the palette to filter AI actions.'
          })
        }}
      />

      {/* Notifications / Activity */}
      {onShowActivity && (
        <IconBtn icon={Bell} label="Activity" onClick={onShowActivity} />
      )}

      {/* Theme toggle — also available in the palette */}
      <IconBtn
        icon={theme === 'dark' ? Sun : Moon}
        label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
      />

      {/* Presence dot — green when online. Not wired to a real presence
          system yet (no collaborative cursors). Static for now. */}
      <span
        className="w-1.5 h-1.5 rounded-full bg-success ml-1"
        title="Online"
        aria-label="Online"
      />
    </header>
  )
}
