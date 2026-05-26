/*
 * ViewSwitcher — DESIGN.md v3.1.5.
 *
 * Two-tab segmented control. Toggles between Kanban view (spatial mode,
 * good for triage) and Tasks view (operational mode, good for getting
 * through 50+ items, the AI-native default).
 *
 * Visual contract (matches design-preview/shell.html):
 *   - Wrapper: bg-muted + 1px border-input + rounded-sm + padding 2px
 *   - Active: bg-card surface + subtle box-shadow press depth
 *   - Inactive: text-muted-foreground, hover text-foreground
 *
 * Persistence + cross-surface sync is owned by useViewMode (also written
 * by the command palette's "Switch view" actions).
 *
 * Keyboard: parent ViewBar exposes the V-then-B / V-then-L chord via the
 * command palette; this component handles direct clicks.
 */

import { LayoutGrid, List } from 'lucide-react'
import React from 'react'
import useViewMode from '../../hooks/useViewMode'

const TABS = [
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'list', label: 'Tasks', icon: List }
]

export default function ViewSwitcher() {
  const [mode, setMode] = useViewMode()

  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-sm bg-muted border border-input"
    >
      {TABS.map(tab => {
        const Icon = tab.icon
        const active = mode === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(tab.id)}
            className={
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[11px] font-emphasis transition-colors ' +
              (active
                ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
