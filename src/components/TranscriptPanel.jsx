import React from 'react'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import useAppStore from '../stores/useAppStore'

export default function TranscriptPanel() {
  const { getSelectedMeeting } = useAppStore()
  const selectedMeeting = getSelectedMeeting()
  const transcript = selectedMeeting?.transcript || ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Live Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
            {transcript ? (
              <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {transcript}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start recording or upload audio to see transcription...</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}