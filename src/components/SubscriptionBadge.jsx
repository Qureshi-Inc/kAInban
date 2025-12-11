import React from 'react'
import { getBadgeConfig } from '../utils/deploymentConfig'

const SubscriptionBadge = ({ className = '' }) => {
  const badgeConfig = getBadgeConfig()

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeConfig.color} ${className}`}>
      <span className="mr-1">{badgeConfig.icon}</span>
      {badgeConfig.text}
    </div>
  )
}

export default SubscriptionBadge