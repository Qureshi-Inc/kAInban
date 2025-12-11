import AudioMotionAnalyzer from 'audiomotion-analyzer'
import React, { useEffect, useRef } from 'react'

export default function AudioVisualizer({ stream, isActive = false }) {
  const containerRef = useRef(null)
  const audioMotionRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !stream) {return}

    let audioContext = null
    let sourceNode = null

    // Initialize AudioMotion analyzer
    try {
      // Create audio context and source node from stream
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      sourceNode = audioContext.createMediaStreamSource(stream)

      // Create AudioMotion analyzer without source (we'll connect manually)
      audioMotionRef.current = new AudioMotionAnalyzer(containerRef.current, {
        audioCtx: audioContext,
        connectSpeakers: false, // Don't connect to speakers since we're just visualizing
        mode: 10, // Line/Area graph mode
        gradient: 'rainbow',
        lineWidth: 2,
        fillAlpha: 0.6,
        showPeaks: false,
        showScaleY: false,
        showScaleX: false,
        overlay: true,
        bgAlpha: 0, // Transparent background
        reflexRatio: 0.3,
        reflexAlpha: 0.2,
        reflexBright: 1,
        barSpace: 0.2,
        ledBars: false,
        lumiBars: false,
        radial: false,
        splitGradient: false,
        channelLayout: 'single', // Use channelLayout instead of deprecated stereo
        smoothing: 0.7
      })

      // Connect the source node to audiomotion's input
      audioMotionRef.current.connectInput(sourceNode)

      console.log('[AudioVisualizer] Initialized with stream')
    } catch (error) {
      console.error('[AudioVisualizer] Initialization error:', error)
    }

    // Cleanup
    return () => {
      if (audioMotionRef.current) {
        try {
          audioMotionRef.current.disconnectInput()
          audioMotionRef.current = null
        } catch (error) {
          console.error('[AudioVisualizer] Cleanup error:', error)
        }
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close()
      }
    }
  }, [stream])

  // Handle active state changes
  useEffect(() => {
    if (audioMotionRef.current) {
      // AudioMotion handles animation automatically
      // Just ensure proper visibility
      if (containerRef.current) {
        containerRef.current.style.opacity = isActive ? '1' : '0.3'
      }
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '120px',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'transparent',
        transition: 'opacity 0.3s ease'
      }}
    />
  )
}
