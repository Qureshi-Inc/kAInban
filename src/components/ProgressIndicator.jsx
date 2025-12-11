import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, XCircle, Upload, FileAudio, Wand2, ListTodo, X } from 'lucide-react'

const ProgressIndicator = ({ progress }) => {
  if (!progress || progress.stage === 'idle') {
    return null
  }

  const stages = [
    { id: 'uploading', label: 'Uploading', icon: Upload, color: 'from-blue-500 to-blue-600' },
    { id: 'converting', label: 'Converting', icon: FileAudio, color: 'from-purple-500 to-purple-600' },
    { id: 'transcribing', label: 'Transcribing', icon: Wand2, color: 'from-indigo-500 to-indigo-600' },
    { id: 'extracting', label: 'Extracting', icon: ListTodo, color: 'from-violet-500 to-violet-600' },
    { id: 'complete', label: 'Complete', icon: CheckCircle2, color: 'from-green-500 to-green-600' },
    { id: 'error', label: 'Error', icon: XCircle, color: 'from-red-500 to-red-600' }
  ]

  const currentStageIndex = stages.findIndex(s => s.id === progress.stage)
  const currentStage = stages[currentStageIndex] || stages[0]
  const CurrentIcon = currentStage.icon

  const isError = progress.stage === 'error'
  const isComplete = progress.stage === 'complete'
  const isProcessing = !isError && !isComplete

  return (
    <AnimatePresence>
      <motion.div
        key="progress-indicator"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="fixed bottom-6 z-50 left-0 right-0 mx-auto sm:left-auto sm:right-6 sm:mx-0 w-[calc(100%-3rem)] sm:w-96"
      >
        <motion.div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-sm"
          layoutId="progress-card"
        >
          {/* Gradient Top Border */}
          <div className={`h-1 bg-gradient-to-r ${currentStage.color}`} />

          <div className="p-5">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${currentStage.color} flex items-center justify-center shadow-lg`}
                  animate={isProcessing ? { rotate: [0, 360] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  {isProcessing ? (
                    <Loader2 size={20} className="text-white" />
                  ) : (
                    <CurrentIcon size={20} className="text-white" />
                  )}
                  {isProcessing && (
                    <motion.div
                      className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent"
                      animate={{ opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </motion.div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {currentStage.label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isProcessing ? 'Processing...' : isComplete ? 'All done!' : 'Failed'}
                  </p>
                </div>
              </div>
              {(isComplete || isError) && (
                <button
                  onClick={progress.onDismiss}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Message */}
            {progress.message && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-gray-600 dark:text-gray-400 mb-4"
              >
                {progress.message}
              </motion.p>
            )}

            {/* Progress Bar */}
            {progress.percentage !== undefined && !isError && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Progress
                  </span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {progress.percentage}%
                  </span>
                </div>
                <div className="relative w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${currentStage.color} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                    animate={{ x: ['0%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: '30%' }}
                  />
                </div>
              </div>
            )}

            {/* Stage Indicators */}
            {!isError && (
              <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                {stages.slice(0, -2).map((stage, index) => {
                  const StageIcon = stage.icon
                  const isComplete = index < currentStageIndex
                  const isCurrent = index === currentStageIndex
                  const isFuture = index > currentStageIndex

                  return (
                    <div key={stage.id} className="flex flex-col items-center gap-2 flex-1">
                      <motion.div
                        className={`
                          relative w-8 h-8 rounded-full flex items-center justify-center
                          ${isComplete ? 'bg-green-500 text-white shadow-lg shadow-green-500/50' : ''}
                          ${isCurrent ? 'bg-gradient-to-br ' + stage.color + ' text-white shadow-lg' : ''}
                          ${isFuture ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : ''}
                          transition-all duration-300
                        `}
                        animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <StageIcon size={14} />
                      </motion.div>
                      <span className={`
                        text-[10px] font-medium text-center
                        ${isComplete ? 'text-green-600 dark:text-green-400' : ''}
                        ${isCurrent ? 'text-gray-900 dark:text-white' : ''}
                        ${isFuture ? 'text-gray-400' : ''}
                      `}
                      >
                        {stage.label}
                      </span>
                      {/* Connector Line */}
                      {index < stages.length - 3 && (
                        <motion.div
                          className={`
                            absolute h-0.5 top-4
                            ${isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                          `}
                          style={{
                            left: '50%',
                            width: `calc(100% / ${stages.length - 2})`
                          }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: isComplete ? 1 : 0 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Error Message */}
            {isError && progress.error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  {progress.error}
                </p>
              </motion.div>
            )}

            {/* Complete Actions */}
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 flex gap-2"
              >
                <button
                  onClick={progress.onDismiss}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02]"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* Error Actions */}
            {isError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 flex gap-2"
              >
                <button
                  onClick={progress.onDismiss}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ProgressIndicator
