import React, { useState, useEffect } from 'react'

export default function DebugPanel() {
  const [logs, setLogs] = useState([])
  const [renderCount, setRenderCount] = useState(0)

  useEffect(() => {
    setRenderCount(prev => prev + 1)

    // Capture console logs
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args) => {
      setLogs(prev => [...prev.slice(-100), { type: 'log', message: args.join(' '), time: new Date().toISOString() }])
      originalLog(...args)
    }

    console.error = (...args) => {
      setLogs(prev => [...prev.slice(-100), { type: 'error', message: args.join(' '), time: new Date().toISOString() }])
      originalError(...args)
    }

    console.warn = (...args) => {
      setLogs(prev => [...prev.slice(-100), { type: 'warn', message: args.join(' '), time: new Date().toISOString() }])
      originalWarn(...args)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 bg-black text-white px-3 py-2 rounded-lg text-xs font-mono"
      >
        🐛 Debug ({renderCount})
      </button>
    )
  }

  return (
    <div className="fixed inset-4 z-50 bg-black text-white rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="font-mono text-sm">
          Debug Console (Renders: {renderCount})
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const storageKey = 'audio-task-manager-storage'
              const rawData = localStorage.getItem(storageKey)
              console.log('[Debug] localStorage check:', {
                hasData: !!rawData,
                keys: Object.keys(localStorage)
              })
              if (rawData) {
                try {
                  const parsed = JSON.parse(rawData)
                } catch (e) {
                  console.error('[Debug] Parse error:', e)
                }
              }
            }}
            className="px-2 py-1 bg-blue-800 rounded text-xs"
          >
            Check Storage
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-2 py-1 bg-gray-800 rounded text-xs"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 bg-gray-800 rounded text-xs"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-muted-foreground">No logs yet...</div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className={`p-1 rounded ${
                log.type === 'error' ? 'bg-red-900/30 text-destructive' :
                  log.type === 'warn' ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-gray-900/30 text-gray-300'
              }`}
            >
              <span className="text-muted-foreground mr-2">
                {new Date(log.time).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-700 text-xs space-y-1">
        <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
        <div>URL: {window.location.href}</div>
        <div>Connection: {navigator.onLine ? 'Online' : 'Offline'}</div>
      </div>
    </div>
  )
}