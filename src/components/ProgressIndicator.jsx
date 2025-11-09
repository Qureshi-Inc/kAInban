import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, XCircle, Upload, FileAudio, Wand2, ListTodo } from 'lucide-react'

const ProgressIndicator = ({ progress }) => {
  if (!progress || progress.stage === 'idle') {
    return null
  }

  const stages = [
    { id: 'uploading', label: 'Uploading file', icon: Upload },
    { id: 'converting', label: 'Converting audio', icon: FileAudio },
    { id: 'transcribing', label: 'Transcribing', icon: Wand2 },
    { id: 'extracting', label: 'Extracting tasks', icon: ListTodo },
    { id: 'complete', label: 'Complete', icon: CheckCircle2 },
    { id: 'error', label: 'Error', icon: XCircle }
  ]

  const currentStageIndex = stages.findIndex(s => s.id === progress.stage)
  const CurrentIcon = stages[currentStageIndex]?.icon || Loader2

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[300px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Processing Audio
            </h3>
            {progress.stage === 'complete' && (
              <button
                onClick={progress.onDismiss}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>

          {/* Current Stage */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`
              ${progress.stage === 'error' ? 'text-red-500' : ''}
              ${progress.stage === 'complete' ? 'text-green-500' : ''}
              ${!['error', 'complete'].includes(progress.stage) ? 'text-blue-500' : ''}
            `}>
              {!['error', 'complete'].includes(progress.stage) ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <CurrentIcon size={24} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {stages[currentStageIndex]?.label || 'Processing...'}
              </p>
              {progress.message && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {progress.message}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {progress.percentage !== undefined && progress.stage !== 'error' && (
            <div className="mb-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-blue-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {progress.percentage}%
              </p>
            </div>
          )}

          {/* Stage Timeline */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            {stages.slice(0, -2).map((stage, index) => {
              const StageIcon = stage.icon
              const isComplete = index < currentStageIndex
              const isCurrent = index === currentStageIndex
              const isFuture = index > currentStageIndex

              return (
                <div key={stage.id} className="flex flex-col items-center gap-1">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs
                    ${isComplete ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-blue-500 text-white animate-pulse' : ''}
                    ${isFuture ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : ''}
                  `}>
                    <StageIcon size={12} />
                  </div>
                  {index < stages.length - 3 && (
                    <div className={`
                      w-full h-0.5 absolute left-1/2 top-3
                      ${isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                    `} style={{ width: 'calc(100% / 4)' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Error Message */}
          {progress.stage === 'error' && progress.error && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
              {progress.error}
            </div>
          )}

          {/* Complete Actions */}
          {progress.stage === 'complete' && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={progress.onDismiss}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ProgressIndicator
