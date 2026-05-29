/*
 * useViewMode — per-workspace view-mode persistence.
 *
 * DESIGN.md v3.1.5 spec:
 *   - Storage key:           `kainban:viewMode:<workspaceId>`
 *   - New users default to   `list`  (Tasks view — the AI-native default)
 *   - Existing users keep    last-used per workspace
 *   - Server-backed when     MULTITENANCY_ENABLED (deferred — local for now)
 *
 * Workspace ID convention: use currentProject.id as a proxy until we model
 * a real workspace entity. The dashboard (no project) uses 'default'. Slice 1
 * (command palette) already writes this key, so we read what it wrote and
 * vice-versa — no migration needed.
 */

import { useCallback, useEffect, useState } from 'react'
import useAppStore from '../stores/useAppStore'

const STORAGE_PREFIX = 'kainban:viewMode:'
const DEFAULT_NEW_USER_MODE = 'list'

function storageKeyFor(workspaceId) {
  return `${STORAGE_PREFIX}${workspaceId || 'default'}`
}

function readPersisted(workspaceId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(workspaceId))
    if (raw === 'kanban' || raw === 'list') {
      return raw
    }
  } catch (_e) {
    // localStorage unavailable — fall through to default.
  }
  return null
}

export default function useViewMode() {
  const currentProject = useAppStore(state => state.currentProject)
  const workspaceId = currentProject?.id || 'default'

  const [mode, setModeState] = useState(
    () => readPersisted(workspaceId) || DEFAULT_NEW_USER_MODE
  )

  // Re-read when the workspace switches (each project has its own
  // preference per the spec).
  useEffect(() => {
    setModeState(readPersisted(workspaceId) || DEFAULT_NEW_USER_MODE)
  }, [workspaceId])

  // Listen for cross-surface writes (e.g. command palette setting the
  // value from another component instance) so the ViewSwitcher stays
  // in sync without prop-drilling. `storage` only fires across tabs;
  // for same-tab cross-component sync we expose a custom event.
  useEffect(() => {
    const onChange = e => {
      if (!e.detail || e.detail.workspaceId !== workspaceId) {
        return
      }
      if (e.detail.mode === 'kanban' || e.detail.mode === 'list') {
        setModeState(e.detail.mode)
      }
    }
    window.addEventListener('kainban:viewmode', onChange)
    return () => window.removeEventListener('kainban:viewmode', onChange)
  }, [workspaceId])

  const setMode = useCallback(
    next => {
      if (next !== 'kanban' && next !== 'list') {
        return
      }
      setModeState(next)
      try {
        localStorage.setItem(storageKeyFor(workspaceId), next)
      } catch (_e) {
        // localStorage unavailable — toggle still works in-session.
      }
      window.dispatchEvent(
        new CustomEvent('kainban:viewmode', {
          detail: { workspaceId, mode: next }
        })
      )
    },
    [workspaceId]
  )

  const toggle = useCallback(() => {
    setMode(mode === 'kanban' ? 'list' : 'kanban')
  }, [mode, setMode])

  return [mode, setMode, toggle]
}
