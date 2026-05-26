/*
 * AppShell — v3.1.1 (DESIGN.md).
 *
 * Three-pane grid: sidebar / main / inspector. Inspector is opt-in by
 * Slice 2 (slot exists, defaults to nothing). The 3 panes never overlap
 * on desktop; below the responsive breakpoint, sidebar and inspector
 * both become full-screen drawers and the canvas takes the full width.
 *
 *   ┌────────┬───────────────────────────────────────┬────────────┐
 *   │        │ TopBar                                │ Inspector  │
 *   │ Side   ├───────────────────────────────────────┤            │
 *   │  bar   │  (view bar slot in Slice 4)           │            │
 *   │        ├───────────────────────────────────────┤            │
 *   │        │       canvas (children)               │            │
 *   │        │                                       │            │
 *   │        ├───────────────────────────────────────┤            │
 *   │        │ (optional footer slot)                │            │
 *   └────────┴───────────────────────────────────────┴────────────┘
 *
 * Responsive breakpoints (matches DESIGN.md v3.1.1):
 *   - md+  (768px+):     sidebar persistent, inspector slot honored
 *   - sm   (<768px):     sidebar becomes drawer behind topbar hamburger
 *
 * The drawer state lives here, not in App.jsx, so the hamburger control
 * in TopBar can flip it via a callback passed down through AppShell.
 * Slice 3 will lift this into store state if any other surface needs to
 * open the sidebar drawer (currently nothing does).
 */

import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children, inspector = null, onShowActivity }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the mobile drawer on viewport resize past the breakpoint so
  // users don't end up with a drawer overlay when they rotate their
  // device or expand the window. Matches md = 768px from Tailwind.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = e => {
      if (e.matches) setDrawerOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Close drawer on Esc.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = e => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div
      className="min-h-screen w-full bg-background text-foreground flex"
      data-shell-root
    >
      {/* Desktop sidebar — persistent column */}
      <div
        className="hidden md:flex flex-col flex-shrink-0"
        style={{ width: 'var(--sidebar-w)' }}
      >
        <Sidebar />
      </div>

      {/* Main column: topbar + canvas (+ optional inspector on wide screens) */}
      <div className="flex-1 flex min-w-0">
        {/* Center column */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            onToggleSidebarMobile={() => setDrawerOpen(true)}
            onShowActivity={onShowActivity}
          />
          <main className="flex-1 min-w-0 overflow-auto bg-background">
            {children}
          </main>
        </div>

        {/* Desktop inspector — only renders when a child requests one */}
        {inspector && (
          <aside
            className="hidden xl:flex flex-col flex-shrink-0 border-l border-border bg-card"
            style={{ width: 'var(--inspector-w)' }}
            data-shell-inspector
          >
            {inspector}
          </aside>
        )}
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden fixed inset-0 bg-black/55 z-40"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 shadow-2xl"
              style={{ width: 'var(--sidebar-w)' }}
              role="dialog"
              aria-label="Navigation"
            >
              <Sidebar onCloseMobile={() => setDrawerOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile inspector drawer — slot exists for Slice 3 when a child
          passes `inspector`. Today we skip rendering it on small screens
          since no surface requests one yet. */}
      {inspector && (
        <aside
          className="xl:hidden fixed inset-0 z-50 bg-card border-l border-border overflow-auto"
          style={{
            display: 'none' // toggled from store in Slice 3
          }}
          data-shell-inspector-mobile
        >
          {inspector}
        </aside>
      )}
    </div>
  )
}
