// Open Source deployment configuration
export const deploymentConfig = {
  mode: 'opensource',
  showBadges: true,
  allowSelfHosted: true
}

// Open Source limits (unlimited)
export const getOpenSourceLimits = () => {
  return {
    maxProjects: 999,
    maxFileSize: 100, // MB
    maxTeamMembers: 999,
    features: ['all']
  }
}

// Badge configuration - OSS only
export const getBadgeConfig = () => {
  return {
    type: 'opensource',
    text: 'Open Source',
    color: 'bg-success/15 text-success border border-success/30',
    icon: '🚀'
  }
}