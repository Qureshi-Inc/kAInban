// Open Source deployment configuration
export const deploymentConfig = {
  mode: 'opensource',
  showBadges: true,
  allowSelfHosted: true,
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
    color: 'bg-green-100 text-green-800',
    icon: '🚀'
  }
}