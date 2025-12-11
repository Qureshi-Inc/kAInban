import React, { useEffect, useRef } from 'react'
import AudioMotionAnalyzer from 'audiomotion-analyzer'

export default function AudioVisualizer({ analyser, isActive = false }) {
  const containerRef = useRef(null)
  const audioMotionRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize AudioMotion analyzer
    try {
      audioMotionRef.current = new AudioMotionAnalyzer(containerRef.current, {
        audioCtx: analyser?.context,
        connectSpeakers: false, // Don't connect to speakers since we're just visualizing
        mode: 10, // Line/Area graph mode
        gradient: 'rainbow',
        lineWidth: 2,
        fillAlpha: 0.6,
        showPeaks: false,
        showScaleY: false,
        showScaleX: false,
        overlay: true,
        bgAlpha: 0,
        reflexRatio: 0.3,
        reflexAlpha: 0.2,
        reflexBright: 1,
        barSpace: 0.2,
        ledBars: false,
        lumiBars: false,
        radial: false,
        splitGradient: false,
        stereo: false,
        smoothing: 0.7
      })

      // Connect the analyzer if available
      if (analyser) {
        // Connect the existing analyser node to audiomotion
        const audioMotion = audioMotionRef.current
        analyser.connect(audioMotion.analyzer)
      }

      console.log('[AudioVisualizer] Initialized')
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
    }
  }, [analyser])

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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        transition: 'opacity 0.3s ease'
      }}
    />
  )
}
