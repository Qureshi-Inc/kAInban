import { motion } from 'framer-motion'
import AnalyticsDashboard from '../components/AnalyticsDashboard'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* v3 breadcrumb: hairline rule, mono kicker, no decorative bullets */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider font-emphasis"
      >
        <span className="text-foreground">Dashboard</span>
        <span className="h-px w-6 bg-border" aria-hidden />
        <span>Overview &amp; Analytics</span>
      </motion.div>

      <AnalyticsDashboard />
    </div>
  )
}
