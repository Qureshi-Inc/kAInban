# AI Instructions - Open Source Repository

You are working on the **OPEN SOURCE** version of kAInban. This repo is public and should remain fully functional without any billing restrictions.

## ✅ DO develop these features here:
- Core functionality (task management, projects, meetings)
- UI/UX improvements
- Bug fixes and performance optimizations
- Security improvements
- New components and features (without billing)
- Mobile responsiveness
- Authentication (PocketID integration)
- Database migrations for core features
- Testing and documentation
- API improvements
- Real-time collaboration features
- Project templates and categories
- Advanced search and filtering

## ❌ DO NOT add these features here:
- Subscription/billing logic
- Stripe integration
- Tier-based limitations
- Usage tracking/analytics for billing purposes
- SaaS-specific badges (only show "🚀 Open Source" badge)
- Payment processing
- Subscription database fields (subscription_tier, stripe_customer_id, etc.)
- Enterprise-only features
- Usage limits or restrictions
- Paid plan enforcement

## Current Repository Status:
- Shows "🚀 Open Source" badge by default
- No subscription fields in database
- Unlimited usage for all features
- No billing restrictions
- Fully functional standalone application

## Development Guidelines:

### If adding hooks for SaaS extensibility:
Make them unlimited/unrestricted in the OSS version.

**Example:**
```javascript
// Good - OSS version with unlimited hook
export const useProjectLimits = () => ({
  maxProjects: 999,
  canCreate: true,
  showUpgrade: false
})
```

### Development Priority:
**Develop features here FIRST**, then they can be enhanced with billing logic in the private SaaS repo.

### Files that should remain OSS-focused:
- `src/utils/deploymentConfig.js` - Only OSS badge
- `src/components/SubscriptionBadge.jsx` - Only shows "🚀 Open Source"
- `server/database.js` - No subscription fields
- All core component files

## Collaboration Notes:
- This repo feeds into a private SaaS fork
- Keep all business logic and billing features out of this codebase
- Focus on making the best open source project management tool
- Community contributions should work without any paid dependencies

---

**Remember: This is a PUBLIC repository. Never add private business logic, API keys, or billing code.**