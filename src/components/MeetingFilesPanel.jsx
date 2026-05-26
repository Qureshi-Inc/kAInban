import { motion } from 'framer-motion'
import { FileAudio, Calendar, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export default function MeetingFilesPanel() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const { meetings, selectedMeetingId, deleteMeeting } = useAppStore()

  const handleSelectMeeting = (meetingId) => {
    // Update URL to include meeting ID (short version)
    const shortMeetingId = meetingId.split('_')[0]
    navigate(`/?project=${projectId}&meeting=${shortMeetingId}`)
  }

  const handleDeleteMeeting = async(meetingId, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this meeting?')) {
      await deleteMeeting(meetingId)
      // If we just deleted the selected meeting, navigate back to project view
      if (selectedMeetingId === meetingId) {
        navigate(`/?project=${projectId}`)
      }
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
      <Card className="border border-border bg-card">
        <CardHeader className="border-b border-border bg-card">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-success/15 border border-success/30 rounded-md text-success">
              <FileAudio className="h-4 w-4" />
            </div>
            <span className="font-serif-display text-2xl">Meeting files</span>
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
                    group p-3 rounded-sm border cursor-pointer transition-colors duration-150
                    ${selectedMeetingId === meeting.id
                  ? 'border-primary/50 bg-primary/8'
                  : 'border-border bg-popover hover:border-input'
                }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate text-foreground">
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
                      className="h-8 w-8 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity hover:bg-destructive/10 dark:hover:bg-red-900/20"
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
