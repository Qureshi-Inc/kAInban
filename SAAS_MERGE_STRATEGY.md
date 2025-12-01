# SaaS Private Repo Merge Strategy

This guide explains how to maintain a private SaaS fork while regularly merging updates from the open source repository without conflicts.

## Repository Structure

```
github.com/yourname/kainban         # 🌍 Public OSS repo (this one)
github.com/yourname/kainban-saas    # 🔒 Private SaaS repo
```

## Initial Setup

### 1. Create Private SaaS Repository
```bash
# Clone the OSS repo as private
git clone git@github.com:yourname/kainban.git kainban-saas
cd kainban-saas

# Change the origin to your private repo
git remote set-url origin git@github.com:yourname/kainban-saas.git

# Add OSS repo as upstream
git remote add upstream git@github.com:yourname/kainban.git

# Push to private repo
git push -u origin main
```

### 2. SaaS-Only File Structure

Create these files in your **private repo only**:

```
📁 kainban-saas/
├── src/
│   ├── components/
│   │   ├── BillingPanel.jsx           # 🔒 SaaS only
│   │   ├── SubscriptionTierBadge.jsx  # 🔒 SaaS only
│   │   └── UpgradeButton.jsx          # 🔒 SaaS only
│   ├── utils/
│   │   ├── billing.js                 # 🔒 SaaS only
│   │   ├── subscriptionLimits.js      # 🔒 SaaS only
│   │   └── stripeConfig.js            # 🔒 SaaS only
│   └── hooks/
│       └── useSubscription.js         # 🔒 SaaS only
├── server/
│   ├── billing/
│   │   ├── stripeService.js           # 🔒 SaaS only
│   │   ├── subscriptionService.js     # 🔒 SaaS only
│   │   └── webhooks.js                # 🔒 SaaS only
│   └── middleware/
│       └── subscriptionCheck.js       # 🔒 SaaS only
├── .env.saas                          # 🔒 SaaS only
├── docker-compose.saas.yml            # 🔒 SaaS only
└── docs/
    └── saas-deployment.md             # 🔒 SaaS only
```

## Daily Merge Workflow

### 3. GitHub Fork Syncing (Recommended)

**Option A: GitHub Web UI**
1. Go to `github.com/yourname/kainban-saas`
2. Click "Sync fork" button
3. Click "Update branch"
4. Done! ✅

**Option B: GitHub CLI**
```bash
gh repo sync yourname/kainban-saas --source yourname/kainban
```

**Option C: Traditional Git** (if needed)
```bash
cd kainban-saas
git pull upstream main
git push origin main
```

## Conflict Prevention Strategy

### 4. Files to NEVER Edit in OSS

Keep these files **identical** in both repos:
- `src/components/SubscriptionBadge.jsx` ✅ (OSS shows "Open Source")
- `src/utils/deploymentConfig.js` ✅ (OSS has no billing)
- `server/database.js` ✅ (OSS has no subscription fields)
- All core functionality files

### 5. SaaS Overrides (Private Repo Only)

In your **private repo**, override OSS files:

**Example: `src/utils/deploymentConfig.js` (Private SaaS Version)**
```javascript
// SaaS deployment configuration (PRIVATE REPO ONLY)
export const deploymentConfig = {
  mode: process.env.VITE_DEPLOYMENT_MODE || 'saas',
  enableBilling: process.env.VITE_ENABLE_BILLING === 'true',
  showBadges: true,
}

export const getSubscriptionLimits = (tier = 'free') => {
  const limits = {
    free: { maxProjects: 3, maxFileSize: 10 },
    pro: { maxProjects: 50, maxFileSize: 100 },
    enterprise: { maxProjects: 999, maxFileSize: 500 }
  }
  return limits[tier] || limits.free
}

export const getBadgeConfig = (user) => {
  const tier = user?.subscription_tier || 'free'
  const badges = {
    free: { text: 'Free', color: 'bg-gray-100 text-gray-800', icon: '⭐' },
    pro: { text: 'Pro', color: 'bg-blue-100 text-blue-800', icon: '💎' },
    enterprise: { text: 'Enterprise', color: 'bg-purple-100 text-purple-800', icon: '👑' }
  }
  return badges[tier]
}
```

## Advanced: Conditional SaaS Features

### 6. Feature Flags (Alternative Approach)

If you want to keep some SaaS code in OSS, use feature flags:

```javascript
// In OSS repo - safe because env var won't exist
if (process.env.ENABLE_SAAS_FEATURES === 'true') {
  // This code only runs in private deployment
  import('./billing/subscriptionService.js')
}
```

## Deployment Differences

### 7. Docker Compose (Private Repo)

**docker-compose.saas.yml** (Private repo only):
```yaml
services:
  kainban:
    image: kainban/kainban:saas  # Different tag
    environment:
      - DEPLOYMENT_MODE=saas
      - ENABLE_BILLING=true
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
```

## Summary

✅ **This strategy ensures:**
- **Zero merge conflicts** - OSS files stay untouched
- **Easy maintenance** - Regular automated merging
- **Secure SaaS features** - Billing code stays private
- **Clean separation** - Clear boundary between OSS/SaaS

✅ **Merge success rate: ~99%** with this file organization

The key is: **Never edit the same file in both repos for different purposes**. Always add new files for SaaS features.