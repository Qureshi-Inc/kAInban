/**
 * TranscriptionQueue - Manages background transcription of audio chunks
 *
 * This service handles queuing and processing of audio chunks for transcription
 * while recording is still active. It processes chunks one at a time to manage
 * memory usage and provides caching of transcripts.
 */

class TranscriptionQueue {
  constructor() {
    this.queue = [] // Pending chunks to process
    this.transcripts = new Map() // chunkIndex -> transcript string
    this.processing = false // Is a chunk currently being processed
    this.errors = new Map() // chunkIndex -> error message
    this.currentProcessing = null // Currently processing chunk index

    // Callbacks
    this.onTranscriptionCompleteCallback = null // Called when a chunk finishes transcribing
    this.onTranscriptionErrorCallback = null // Called when a chunk fails
  }

  /**
   * Set callback for when transcription completes
   * @param {Function} callback - Function(chunkIndex, transcript, status) called on completion
   */
  setOnTranscriptionComplete(callback) {
    this.onTranscriptionCompleteCallback = callback
  }

  /**
   * Set callback for when transcription fails
   * @param {Function} callback - Function(chunkIndex, error, status) called on error
   */
  setOnTranscriptionError(callback) {
    this.onTranscriptionErrorCallback = callback
  }

  /**
   * Add a chunk to the transcription queue
   * @param {Blob} chunkBlob - The audio blob to transcribe
   * @param {number} chunkIndex - The index of this chunk
   */
  async enqueueChunk(chunkBlob, chunkIndex) {
    console.log(`[TranscriptionQueue] Enqueuing chunk ${chunkIndex} (${(chunkBlob.size / 1024 / 1024).toFixed(2)} MB)`)

    this.queue.push({ chunkBlob, chunkIndex })

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }
  }

  /**
   * Process the queue - transcribes chunks one at a time
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false
      this.currentProcessing = null
      console.log('[TranscriptionQueue] Queue empty, processing stopped')
      return
    }

    this.processing = true
    const { chunkBlob, chunkIndex } = this.queue.shift()
    this.currentProcessing = chunkIndex

    try {

      // Validate blob
      if (!chunkBlob || chunkBlob.size === 0) {
        throw new Error('Invalid or empty audio blob')
      }

      console.log(`[TranscriptionQueue] Chunk ${chunkIndex} blob: ${(chunkBlob.size / 1024 / 1024).toFixed(2)} MB, type: ${chunkBlob.type}`)

      // For WebM blobs from recording, send directly to Azure (it supports WebM)
      // Only M4A and other formats need WAV conversion
      console.log(`[TranscriptionQueue] Transcribing chunk ${chunkIndex} directly (WebM format supported by Azure)...`)

      // Import openaiService and transcribe
      const openaiService = (await import('./openaiService.js')).default
      const transcript = await openaiService.transcribeAudio(chunkBlob)

      // Store result
      this.transcripts.set(chunkIndex, transcript)

      // Trigger success callback
      if (this.onTranscriptionCompleteCallback) {
        const status = this.getStatus()
        this.onTranscriptionCompleteCallback(chunkIndex, transcript, status)
      }

    } catch (error) {
      console.error(`[TranscriptionQueue] ✗ Error transcribing chunk ${chunkIndex}:`, error)
      this.errors.set(chunkIndex, error.message)

      // Trigger error callback
      if (this.onTranscriptionErrorCallback) {
        const status = this.getStatus()
        this.onTranscriptionErrorCallback(chunkIndex, error.message, status)
      }
    }

    // Continue processing queue
    setTimeout(() => this.processQueue(), 100)
  }

  /**
   * Get transcript for a specific chunk
   * @param {number} chunkIndex - The chunk index
   * @returns {string|null} The transcript or null if not available
   */
  getTranscript(chunkIndex) {
    return this.transcripts.get(chunkIndex) || null
  }

  /**
   * Get all transcripts in order
   * @returns {string[]} Array of transcripts ordered by chunk index
   */
  getAllTranscripts() {
    const indices = Array.from(this.transcripts.keys()).sort((a, b) => a - b)
    return indices.map(idx => this.transcripts.get(idx))
  }

  /**
   * Get current queue status
   * @returns {object} Status object with counts
   */
  getStatus() {
    return {
      queued: this.queue.length,
      transcribed: this.transcripts.size,
      errors: this.errors.size,
      processing: this.processing,
      currentProcessing: this.currentProcessing
    }
  }

  /**
   * Check if a specific chunk has been transcribed
   * @param {number} chunkIndex - The chunk index
   * @returns {boolean} True if transcribed
   */
  isTranscribed(chunkIndex) {
    return this.transcripts.has(chunkIndex)
  }

  /**
   * Check if a specific chunk has an error
   * @param {number} chunkIndex - The chunk index
   * @returns {string|null} Error message or null
   */
  getError(chunkIndex) {
    return this.errors.get(chunkIndex) || null
  }

  /**
   * Get all errors
   * @returns {Array} Array of {chunkIndex, error} objects
   */
  getAllErrors() {
    return Array.from(this.errors.entries()).map(([chunkIndex, error]) => ({
      chunkIndex,
      error
    }))
  }

  /**
   * Reset the queue - clears all state
   */
  reset() {
    console.log('[TranscriptionQueue] Resetting queue')
    this.queue = []
    this.transcripts.clear()
    this.errors.clear()
    this.processing = false
    this.currentProcessing = null
  }

  /**
   * Retry transcription for a failed chunk
   * @param {Blob} chunkBlob - The audio blob to retry
   * @param {number} chunkIndex - The chunk index
   */
  async retryChunk(chunkBlob, chunkIndex) {
    console.log(`[TranscriptionQueue] Retrying chunk ${chunkIndex}`)

    // Remove error entry
    this.errors.delete(chunkIndex)

    // Re-enqueue
    await this.enqueueChunk(chunkBlob, chunkIndex)
  }
}

// Export singleton instance
export default new TranscriptionQueue()
