import { motion } from 'framer-motion'
import AnalyticsDashboard from '../components/AnalyticsDashboard'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb for context */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span className="font-medium">Dashboard</span>
        <span className="text-xs">•</span>
        <span>Overview & Analytics</span>
      </motion.div>

      <AnalyticsDashboard />
    </div>
  )
}
