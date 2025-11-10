class AudioService {
  constructor() {
    this.mediaRecorder = null
    this.audioChunks = []
    this.stream = null
    this.audioContext = null
    this.analyser = null
    this.animationId = null

    // Chunking support for long recordings
    this.recordingChunks = [] // Array of chunk arrays
    this.currentChunkIndex = 0
    this.chunkDuration = 600 // 10 minutes in seconds
    this.chunkStartTime = null
    this.chunkTimer = null

    // Callback for when a chunk is completed during recording
    this.onChunkCompleteCallback = null
  }

  async requestMicrophonePermission() {
    try {
      // Check if we're on HTTPS or localhost
      const isSecureContext = window.isSecureContext ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.protocol === 'file:'

      if (!isSecureContext) {
        throw new Error('Microphone access requires HTTPS. Please use HTTPS or run on localhost.')
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser.')
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      // Stop the stream immediately - we just wanted to check permissions
      stream.getTracks().forEach(track => track.stop())

      return true
    } catch (error) {
      console.error('Microphone permission error:', error)
      throw new Error(`Microphone access denied: ${error.message}`)
    }
  }

  async startRecording() {
    try {
      await this.requestMicrophonePermission()

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      // Check for MediaRecorder support and codec compatibility
      // Prioritize WebM format which works reliably with complete files
      const mimeTypes = [
        'audio/webm;codecs=opus',      // Best - works with complete files
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',                   // Avoid - MP4+Opus is invalid
        'audio/wav'
      ]

      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio format found for recording')
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType
      })

      // Initialize chunking system
      this.audioChunks = []
      this.recordingChunks = [[]] // Start with first chunk array
      this.currentChunkIndex = 0
      this.chunkStartTime = Date.now()

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
          // Add to current chunk
          this.recordingChunks[this.currentChunkIndex].push(event.data)
        }
      }

      this.mediaRecorder.start(1000) // Collect data every second
      this.setupAudioVisualization()
      this.startChunkTimer() // Start monitoring chunk duration

      return true
    } catch (error) {
      console.error('Recording start error:', error)
      throw error
    }
  }

  setupAudioVisualization() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      const source = this.audioContext.createMediaStreamSource(this.stream)

      source.connect(this.analyser)
      this.analyser.fftSize = 256
    } catch (error) {
      console.warn('Audio visualization setup failed:', error)
    }
  }

  startChunkTimer() {
    // Check chunk duration every second
    this.chunkTimer = setInterval(() => {
      if (!this.chunkStartTime) return

      const elapsedSeconds = (Date.now() - this.chunkStartTime) / 1000

      // If chunk duration exceeded, start a new chunk
      if (elapsedSeconds >= this.chunkDuration) {
        this.rotateToNextChunk()
      }
    }, 1000)
  }

  rotateToNextChunk() {
    console.log(`[AudioService] === CHUNK ROTATION START ===`)
    console.log(`[AudioService] Rotating from chunk ${this.currentChunkIndex} to ${this.currentChunkIndex + 1}`)

    // Get reference to completed chunk data
    const completedChunkIndex = this.currentChunkIndex
    const completedChunkData = [...this.recordingChunks[completedChunkIndex]] // Copy array

    console.log(`[AudioService] Completed chunk ${completedChunkIndex} has ${completedChunkData.length} fragments`)

    // Store mimeType before stopping
    const currentMimeType = this.mediaRecorder.mimeType
    const currentStream = this.stream

    // CRITICAL FIX: Stop MediaRecorder to finalize the WebM file properly
    console.log('[AudioService] Stopping MediaRecorder to finalize chunk...')

    // Set up onstop handler to create the chunk blob
    this.mediaRecorder.onstop = () => {
      console.log('[AudioService] MediaRecorder stopped, creating chunk blob...')

      if (this.onChunkCompleteCallback && completedChunkData.length > 0) {
        const chunkBlob = new Blob(completedChunkData, { type: currentMimeType })

        console.log(`[AudioService] ✓ Chunk ${completedChunkIndex} finalized:`)
        console.log(`[AudioService]   - Size: ${(chunkBlob.size / 1024 / 1024).toFixed(2)} MB`)
        console.log(`[AudioService]   - Type: ${chunkBlob.type}`)
        console.log(`[AudioService]   - Fragments: ${completedChunkData.length}`)
        console.log(`[AudioService]   - First fragment: ${(completedChunkData[0]?.size / 1024).toFixed(2)} KB`)

        // Trigger callback with completed chunk
        this.onChunkCompleteCallback(chunkBlob, completedChunkIndex)
      }

      // Now prepare for next chunk
      this.currentChunkIndex++
      this.recordingChunks[this.currentChunkIndex] = []
      this.chunkStartTime = Date.now()

      console.log(`[AudioService] Starting NEW MediaRecorder for chunk ${this.currentChunkIndex}...`)

      // Create NEW MediaRecorder - this ensures fresh WebM initialization segment
      try {
        this.mediaRecorder = new MediaRecorder(currentStream, {
          mimeType: currentMimeType
        })

        // Reattach handlers
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data)
            this.recordingChunks[this.currentChunkIndex].push(event.data)
          }
        }

        this.mediaRecorder.onerror = (error) => {
          console.error('[AudioService] MediaRecorder error:', error)
        }

        // Start recording with 1-second timeslice
        this.mediaRecorder.start(1000)
        console.log(`[AudioService] ✓ MediaRecorder restarted for chunk ${this.currentChunkIndex}`)
        console.log('[AudioService] === CHUNK ROTATION COMPLETE ===')
      } catch (error) {
        console.error('[AudioService] ✗ Failed to restart MediaRecorder:', error)
      }
    }

    // Trigger the stop
    this.mediaRecorder.stop()
  }

  /**
   * Set callback to be triggered when a chunk completes during recording
   * @param {Function} callback - Function(chunkBlob, chunkIndex) called when chunk completes
   */
  setOnChunkComplete(callback) {
    this.onChunkCompleteCallback = callback
    console.log('[AudioService] Chunk completion callback registered')
  }

  /**
   * Clear the chunk completion callback
   */
  clearOnChunkComplete() {
    this.onChunkCompleteCallback = null
    console.log('[AudioService] Chunk completion callback cleared')
  }

  getCurrentChunkInfo() {
    if (!this.chunkStartTime) return null

    const elapsedSeconds = Math.floor((Date.now() - this.chunkStartTime) / 1000)
    const remainingSeconds = Math.max(0, this.chunkDuration - elapsedSeconds)

    return {
      currentChunk: this.currentChunkIndex + 1,
      totalChunks: this.recordingChunks.length,
      elapsedInChunk: elapsedSeconds,
      remainingInChunk: remainingSeconds,
      chunkDuration: this.chunkDuration
    }
  }

  getVisualizationData() {
    if (!this.analyser) return null

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)
    return dataArray
  }

  pauseRecording() {
    if (!this.mediaRecorder) {
      throw new Error('No recording in progress')
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause()
      console.log('[AudioService] Recording paused')
      return true
    }
    return false
  }

  resumeRecording() {
    if (!this.mediaRecorder) {
      throw new Error('No recording in progress')
    }

    if (this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume()
      console.log('[AudioService] Recording resumed')
      return true
    }
    return false
  }

  isPaused() {
    return this.mediaRecorder && this.mediaRecorder.state === 'paused'
  }

  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'))
        return
      }

      // Stop chunk timer
      if (this.chunkTimer) {
        clearInterval(this.chunkTimer)
        this.chunkTimer = null
      }

      const mimeType = this.mediaRecorder.mimeType || 'audio/webm'

      this.mediaRecorder.onstop = () => {
        try {
          // Check if we have multiple chunks (recording > 10 minutes)
          if (this.recordingChunks.length > 1 || this.currentChunkIndex > 0) {
            console.log(`[AudioService] Recording split into ${this.recordingChunks.length} chunks`)

            // Create separate blobs for each chunk
            const chunkBlobs = this.recordingChunks.map((chunkData, index) => {
              const blob = new Blob(chunkData, { type: mimeType })
              console.log(`[AudioService] Chunk ${index + 1} size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`)
              return blob
            })

            // Clean up
            this.cleanup()

            // Return array of blobs indicating chunked recording
            resolve({
              isChunked: true,
              chunks: chunkBlobs,
              mimeType: mimeType
            })
          } else {
            // Single recording (< 10 minutes)
            const audioBlob = new Blob(this.audioChunks, { type: mimeType })
            console.log(`[AudioService] Single recording size: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`)

            // Clean up
            this.cleanup()

            resolve(audioBlob)
          }
        } catch (error) {
          reject(error)
        }
      }

      this.mediaRecorder.onerror = (error) => {
        this.cleanup()
        reject(error)
      }

      try {
        this.mediaRecorder.stop()
      } catch (error) {
        this.cleanup()
        reject(error)
      }
    })
  }

  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }

    this.mediaRecorder = null
    this.analyser = null
    this.audioChunks = []
    this.recordingChunks = []
    this.currentChunkIndex = 0
    this.chunkStartTime = null
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === 'recording'
  }

  // Resample audio buffer and convert to mono
  async resampleAndConvertToMono(audioBuffer, targetSampleRate) {
    const offlineContext = new OfflineAudioContext(
      1, // mono (1 channel)
      audioBuffer.duration * targetSampleRate,
      targetSampleRate
    )

    // Create buffer source
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer

    // Connect to destination
    source.connect(offlineContext.destination)
    source.start()

    // Render the audio
    const renderedBuffer = await offlineContext.startRendering()

    // Note: OfflineAudioContext doesn't have a close() method
    // It automatically releases resources after rendering completes

    return renderedBuffer
  }

  // Convert m4a to WAV format using Web Audio API
  async convertM4aToWav(file) {
    console.log('[AudioService] Converting m4a to WAV format...')

    // Detect if running on mobile for memory warnings
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && file.size > 20 * 1024 * 1024) {
      console.warn('[AudioService] ⚠️ Large file on mobile - using aggressive memory optimization')
    }

    try {
      // Step 1: Read file as array buffer
      let arrayBuffer = await file.arrayBuffer()
      const arrayBufferSize = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2)
      console.log('[AudioService] Step 1: Loaded arrayBuffer:', arrayBufferSize, 'MB')

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()

      // Step 2: Decode audio data (creates AudioBuffer in memory)
      console.log('[AudioService] Step 2: Decoding audio data...')
      let audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      console.log('[AudioService] Audio decoded successfully')
      console.log('[AudioService] Duration:', audioBuffer.duration.toFixed(2), 'seconds')
      console.log('[AudioService] Original sample rate:', audioBuffer.sampleRate, 'Hz')
      console.log('[AudioService] Original channels:', audioBuffer.numberOfChannels)

      // ✅ MEMORY OPTIMIZATION: Release arrayBuffer immediately after decoding
      arrayBuffer = null
      console.log('[AudioService] ✓ Released arrayBuffer from memory')

      // Step 3: Resample to 16kHz mono to reduce file size (voice quality is still excellent)
      console.log('[AudioService] Step 3: Resampling to 16kHz mono...')
      const resampledBuffer = await this.resampleAndConvertToMono(audioBuffer, 16000)
      console.log('[AudioService] Resampled to 16kHz mono')

      // ✅ MEMORY OPTIMIZATION: Release original audioBuffer after resampling
      audioBuffer = null
      console.log('[AudioService] ✓ Released original audioBuffer from memory')

      // Step 4: Convert to WAV format
      console.log('[AudioService] Step 4: Converting to WAV...')
      const wavBlob = this.audioBufferToWav(resampledBuffer)
      console.log('[AudioService] Converted to WAV, size:', (wavBlob.size / 1024 / 1024).toFixed(2), 'MB')

      // Create a new File object with .wav extension
      const wavFile = new File([wavBlob], 'audio.wav', { type: 'audio/wav' })

      await audioContext.close()

      // Always return buffer for M4A conversion (needed for chunking logic in processAudioFile)
      return { file: wavFile, buffer: resampledBuffer }
    } catch (error) {
      console.error('[AudioService] Conversion error:', error.message)
      throw new Error('Failed to convert m4a file. The file may be corrupted or use an unsupported codec.')
    }
  }

  // Split audio buffer into chunks
  splitAudioBuffer(audioBuffer, chunkDurationSeconds) {
    const sampleRate = audioBuffer.sampleRate
    const samplesPerChunk = Math.floor(chunkDurationSeconds * sampleRate)
    const totalSamples = audioBuffer.length
    const chunks = []

    for (let start = 0; start < totalSamples; start += samplesPerChunk) {
      const end = Math.min(start + samplesPerChunk, totalSamples)
      const chunkLength = end - start

      // Create a new buffer for this chunk
      const chunkBuffer = new AudioContext().createBuffer(
        audioBuffer.numberOfChannels,
        chunkLength,
        sampleRate
      )

      // Copy data for each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel)
        const chunkData = chunkBuffer.getChannelData(channel)
        for (let i = 0; i < chunkLength; i++) {
          chunkData[i] = sourceData[start + i]
        }
      }

      chunks.push(chunkBuffer)
    }

    return chunks
  }

  // Helper function to convert AudioBuffer to WAV format
  audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16

    let length = buffer.length * numChannels * 2
    let arrayBuffer = new ArrayBuffer(44 + length)
    let view = new DataView(arrayBuffer)

    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true)
    view.setUint16(32, numChannels * bitDepth / 8, true)
    view.setUint16(34, bitDepth, true)
    writeString(36, 'data')
    view.setUint32(40, length, true)

    // Write audio data
    const channels = []
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    let offset = 44
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }

    const blob = new Blob([arrayBuffer], { type: 'audio/wav' })

    // ✅ MEMORY OPTIMIZATION: Help GC by nullifying large typed arrays
    arrayBuffer = null
    view = null

    return blob
  }

  // Convert audio file to the format needed for transcription
  async processAudioFile(file) {
    try {
      console.log('[AudioService] ===== FILE UPLOAD START =====')
      console.log('[AudioService] File name:', file.name)
      console.log('[AudioService] File type (MIME):', file.type || 'NO MIME TYPE')
      console.log('[AudioService] File size:', file.size, 'bytes', '(' + (file.size / 1024 / 1024).toFixed(2) + ' MB)')

      // Validate file type - allow audio/* or specific extensions
      const validExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg', '.flac']
      const fileName = file.name.toLowerCase()
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))

      console.log('[AudioService] File extension valid?', hasValidExtension)
      console.log('[AudioService] Has audio MIME type?', file.type.startsWith('audio/'))

      // Accept if either MIME type is audio/* OR has valid extension
      if (!file.type.startsWith('audio/') && !hasValidExtension) {
        console.error('[AudioService] ✗ File rejected: Invalid type')
        throw new Error('Please select a valid audio file (mp3, mp4, m4a, wav, webm, ogg, flac)')
      }

      console.log('[AudioService] ✓ File type validated')

      // Azure OpenAI Whisper has a hard limit of 25MB
      const maxSize = 25 * 1024 * 1024 // 25MB
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)

      // For m4a files, we need to convert them, which may increase size
      // Check if original file is way too large (over 100MB likely won't compress enough)
      if (file.size > 100 * 1024 * 1024) {
        console.error('[AudioService] ✗ File rejected: Way too large for processing')
        throw new Error(`Audio file is ${fileSizeMB}MB. Files over 100MB cannot be processed. Please use a shorter recording or compress the audio file first.`)
      }

      // Convert .m4a files to WAV format
      // Azure OpenAI Whisper doesn't support all m4a codecs, so we convert to WAV
      let processedFile = file
      let audioBuffer = null

      if (fileName.endsWith('.m4a')) {
        console.log('[AudioService] Detected .m4a file - converting to WAV with compression')
        const result = await this.convertM4aToWav(file)
        processedFile = result.file
        audioBuffer = result.buffer
        const convertedSizeMB = (processedFile.size / 1024 / 1024).toFixed(2)
        console.log('[AudioService] Converted file size:', convertedSizeMB, 'MB')

        // Check converted file size
        if (processedFile.size > maxSize) {
          // File is too large, will need chunking
          console.log('[AudioService] ⚠ File exceeds 25MB limit, will use chunking for transcription')
          console.log('[AudioService] Duration:', audioBuffer.duration.toFixed(2), 'seconds')

          // Return special object indicating chunking is needed
          return {
            needsChunking: true,
            buffer: audioBuffer,
            duration: audioBuffer.duration,
            originalFile: processedFile,
            sizeMB: convertedSizeMB
          }
        } else {
          // ✅ MEMORY OPTIMIZATION: File under 25MB doesn't need chunking, release buffer
          audioBuffer = null
          console.log('[AudioService] ✓ File <25MB, released buffer from memory')
        }
      } else {
        // For non-m4a files, check size directly
        if (file.size > maxSize) {
          console.error('[AudioService] ✗ File rejected: Too large')
          throw new Error(`Audio file is ${fileSizeMB}MB, which exceeds Azure's 25MB limit. For files over 25MB, please convert to .m4a format first, which enables automatic chunking.`)
        }
      }

      console.log('[AudioService] ✓ File size validated')
      console.log('[AudioService] ✓ File validated successfully')
      console.log('[AudioService] ===== FILE UPLOAD COMPLETE =====')
      return processedFile
    } catch (error) {
      console.error('[AudioService] ✗ Audio file processing error:', error.message)
      console.error('[AudioService] ===== FILE UPLOAD FAILED =====')
      throw error
    }
  }
}

export default new AudioService()