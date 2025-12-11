import { motion } from 'framer-motion'
import { FileAudio, Calendar, Trash2 } from 'lucide-react'
import React from 'react'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export default function MeetingFilesPanel() {
  const { meetings, selectedMeetingId, selectMeeting, deleteMeeting } = useAppStore()

  const handleSelectMeeting = (meetingId) => {
    selectMeeting(meetingId)
  }

  const handleDeleteMeeting = async(meetingId, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this meeting?')) {
      await deleteMeeting(meetingId)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="border-2 shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50">
        <CardHeader className="bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-900/10 border-b-2">
          <CardTitle className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <FileAudio className="h-5 w-5 text-white" />
            </motion.div>
            <span className="text-xl font-bold">Meeting Files</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="min-h-[300px] max-h-[500px] overflow-y-auto space-y-2">
            {meetings && meetings.length > 0 ? (
              meetings.map((meeting) => (
                <motion.div
                  key={meeting.id}
                  onClick={() => handleSelectMeeting(meeting.id)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  transition={{ duration: 0.2 }}
                  className={`
                    group p-3 rounded-lg border-2 cursor-pointer transition-all
                    hover:shadow-lg
                    ${selectedMeetingId === meeting.id
                  ? 'border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50'
                }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate text-gray-900 dark:text-gray-100">
                        {meeting.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 font-medium">
                        <Calendar className="h-3 w-3" />
                        {formatDate(meeting.createdAt)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <FileAudio className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">No meeting files yet...</p>
                  <p className="text-xs mt-2 opacity-60">Record or upload audio to create meeting files</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
