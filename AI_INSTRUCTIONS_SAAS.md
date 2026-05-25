# AI Instructions - Private SaaS Repository

You are working on the **PRIVATE SAAS** version of kAInban. This repo is a private fork of the open source version and includes billing/subscription features.

## ✅ DO develop these features here:
- Subscription tiers and billing logic
- Stripe payment integration
- Usage limits and enforcement
- Tier-based badges (Free ⭐, Pro 💎, Enterprise 👑)
- Analytics and usage tracking for billing
- Subscription database fields
- Enterprise features (SSO, advanced reporting)
- SaaS-specific UI components
- Billing management dashboard
- Plan upgrade/downgrade flows
- Payment webhooks and processing
- Invoice generation
- Usage monitoring and alerts
- Customer success features

## ✅ ALSO sync these from OSS repo:
- All core functionality improvements
- Bug fixes and security updates
- New features from open source
- UI/UX improvements
- Performance optimizations
- Authentication improvements

## How to Sync from OSS Repository:

### Method 1: GitHub Web UI (Recommended)
1. Go to GitHub.com → your private fork
2. Look for "This branch is X commits behind" message
3. Click "Sync fork" button
4. Click "Update branch"
5. Resolve any conflicts (should be rare with proper file organization)

### Method 2: GitHub CLI
```bash
gh repo sync yourname/kainban-saas --source yourname/kainban
```

### Method 3: Git Command Line
```bash
git fetch upstream
git merge upstream/main
git push origin main
```

## SaaS-Specific File Overrides:

### Required Overrides (replace OSS versions):
- `src/utils/deploymentConfig.js` - Add tier logic and SaaS badges
- `src/components/SubscriptionBadge.jsx` - Show tier-specific badges
- `server/database.js` - Add subscription fields to users table

### New SaaS-Only Files (add these):
```
src/
├── components/
│   ├── BillingPanel.jsx
│   ├── SubscriptionTierBadge.jsx
│   ├── UpgradeButton.jsx
│   └── PaymentForm.jsx
├── utils/
│   ├── billing.js
│   ├── subscriptionLimits.js
│   └── stripeConfig.js
├── hooks/
│   └── useSubscription.js
server/
├── billing/
│   ├── stripeService.js
│   ├── subscriptionService.js
│   └── webhooks.js
├── middleware/
│   └── subscriptionCheck.js
└── routes/
    └── billing.js
```

## Subscription Tiers Configuration:

```javascript
const SUBSCRIPTION_LIMITS = {
  free: {
    maxProjects: 3,
    maxFileSize: 10, // MB
    maxTeamMembers: 1,
    features: ['basic']
  },
  pro: {
    maxProjects: 50,
    maxFileSize: 100, // MB
    maxTeamMembers: 10,
    features: ['basic', 'collaboration', 'priority-support']
  },
  enterprise: {
    maxProjects: 999,
    maxFileSize: 500, // MB
    maxTeamMembers: 999,
    features: ['basic', 'collaboration', 'priority-support', 'sso', 'analytics']
  }
}
```

## Environment Variables (SaaS Only):
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Deployment Mode
DEPLOYMENT_MODE=saas
ENABLE_BILLING=true
ENABLE_ANALYTICS=true

# Database
# Add subscription fields to existing database
```

## Development Guidelines:

### Core Feature Development:
1. **Develop new core features in OSS repo first**
2. **Sync to SaaS repo via fork sync**
3. **Add billing/limit logic on top of core feature**

### SaaS-Only Feature Development:
- Develop billing features directly in this repo
- Never merge SaaS-specific code back to OSS
- Keep business logic and pricing private

### Database Migrations:
```sql
-- Add to existing users table (SaaS only)
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_expires DATETIME;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN billing_email TEXT;
```

## Conflict Resolution:
If merge conflicts occur during sync:
1. **Core functionality files**: Usually accept OSS changes
2. **SaaS override files**: Keep SaaS version
3. **New SaaS files**: No conflicts (SaaS-only)

## Security Notes:
- Never commit Stripe keys to repository
- Use environment variables for all secrets
- Implement proper webhook signature verification
- Log billing events for audit trails

## Testing:
- Test both free and paid tier functionality
- Verify billing flows end-to-end
- Test subscription upgrades/downgrades
- Validate usage limit enforcement

---

**Remember: This is a PRIVATE repository. Keep all business logic, billing code, and sensitive information secure.**