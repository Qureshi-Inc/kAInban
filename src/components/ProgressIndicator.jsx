import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  FileAudio,
  Wand2,
  ListTodo,
  X
} from 'lucide-react'

/*
 * ProgressIndicator — Design System v3.
 *
 * v2 used per-stage gradients (blue → purple → indigo → violet → green → red)
 * with scale animations and shadowed glows. v3 collapses all stage states to
 * a single accent token, varying only by phase (processing | complete | error)
 * and using opacity/border for stage progression. See DESIGN.md → Motion.
 */
const ProgressIndicator = ({ progress }) => {
  if (!progress || progress.stage === 'idle') {
    return null
  }

  const stages = [
    { id: 'uploading', label: 'Uploading', icon: Upload },
    { id: 'converting', label: 'Converting', icon: FileAudio },
    { id: 'transcribing', label: 'Transcribing', icon: Wand2 },
    { id: 'extracting', label: 'Extracting', icon: ListTodo },
    { id: 'complete', label: 'Complete', icon: CheckCircle2 },
    { id: 'error', label: 'Error', icon: XCircle }
  ]

  const currentStageIndex = stages.findIndex(s => s.id === progress.stage)
  const currentStage = stages[currentStageIndex] || stages[0]
  const CurrentIcon = currentStage.icon

  const isError = progress.stage === 'error'
  const isComplete = progress.stage === 'complete'
  const isProcessing = !isError && !isComplete

  // Phase determines accent token: processing uses primary, complete uses
  // success, error uses destructive. No per-stage hue variation.
  const phaseClasses = isError
    ? { bar: 'bg-destructive', tile: 'bg-destructive/15 border-destructive/40 text-destructive' }
    : isComplete
      ? { bar: 'bg-success', tile: 'bg-success/15 border-success/40 text-success' }
      : { bar: 'bg-primary', tile: 'bg-primary/15 border-primary/40 text-primary' }

  return (
    <AnimatePresence>
      <motion.div
        key="progress-indicator"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 z-50 left-0 right-0 mx-auto sm:left-auto sm:right-6 sm:mx-0 w-[calc(100%-3rem)] sm:w-96"
      >
        <motion.div
          className="bg-card border border-border rounded-md shadow-lg overflow-hidden"
          layoutId="progress-card"
        >
          {/* Top phase rule — single accent, no gradient. */}
          <div className={`h-0.5 ${phaseClasses.bar}`} />

          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`relative w-9 h-9 rounded-md flex items-center justify-center border ${phaseClasses.tile}`}
                >
                  {isProcessing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CurrentIcon size={18} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-emphasis tracking-tight text-foreground">
                    {currentStage.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isProcessing
                      ? 'Processing'
                      : isComplete
                        ? 'All done'
                        : 'Failed'}
                  </p>
                </div>
              </div>
              {(isComplete || isError) && (
                <button
                  onClick={progress.onDismiss}
                  className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Message */}
            {progress.message && (
              <p className="text-sm text-muted-foreground mb-4">
                {progress.message}
              </p>
            )}

            {/* Progress bar */}
            {progress.percentage !== undefined && !isError && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] tracking-wider uppercase text-muted-foreground font-emphasis">
                    Progress
                  </span>
                  <span className="text-xs font-mono-tabular text-foreground">
                    {progress.percentage}%
                  </span>
                </div>
                <div className="relative w-full h-1 bg-muted overflow-hidden rounded-sm">
                  <motion.div
                    className={`absolute inset-y-0 left-0 ${phaseClasses.bar} rounded-sm`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            )}

            {/* Stage indicators — uniform accent, no per-stage hue. */}
            {!isError && (
              <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-border">
                {stages.slice(0, -2).map((stage, index) => {
                  const StageIcon = stage.icon
                  const isStageDone = index < currentStageIndex
                  const isCurrent = index === currentStageIndex

                  const stageClasses = isStageDone
                    ? 'bg-success/15 border-success/40 text-success'
                    : isCurrent
                      ? phaseClasses.tile
                      : 'bg-muted border-border text-muted-foreground'

                  return (
                    <div
                      key={stage.id}
                      className="flex flex-col items-center gap-2 flex-1"
                    >
                      <div
                        className={`relative w-7 h-7 rounded-sm flex items-center justify-center border ${stageClasses} transition-colors duration-150`}
                      >
                        <StageIcon size={12} />
                      </div>
                      <span
                        className={`text-[10px] text-center tracking-wide ${
                          isStageDone
                            ? 'text-success'
                            : isCurrent
                              ? 'text-foreground font-emphasis'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Error message */}
            {isError && progress.error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
                <p className="text-sm text-destructive">{progress.error}</p>
              </div>
            )}

            {/* Complete actions */}
            {isComplete && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={progress.onDismiss}
                  className="flex-1 px-4 py-2 text-sm font-emphasis text-primary-foreground bg-primary hover:bg-primary/90 rounded-sm transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Error actions */}
            {isError && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={progress.onDismiss}
                  className="flex-1 px-4 py-2 text-sm font-emphasis text-foreground bg-secondary hover:bg-muted border border-border rounded-sm transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ProgressIndicator
