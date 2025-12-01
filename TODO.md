# kAInban Development TODO

## 🚧 In Progress
- [ ] Create persistent TODO.md file for cross-session tracking

## 🔄 High Priority Features

### Database & Architecture
- [ ] Migrate database schema to support multi-tenant workspaces
  - Add `workspaces` table
  - Add `workspace_members` table with roles
  - Update `projects` to be workspace-scoped
  - Migrate existing data

### Core Features
- [ ] Update subtask completion tracking and auto-move to done status
  - Auto-complete tasks when all subtasks are done
  - Add visual progress indicators
  - Update task status automatically

- [ ] Add project categories with drag-and-drop organization
  - Create category management UI
  - Implement drag-and-drop between categories
  - Add category colors/icons

- [ ] Add shared section functionality for users
  - Define shared section requirements
  - Implement sharing permissions
  - Add collaboration features

### UI/UX Improvements
- [ ] Allow renaming swimlanes and changing swimlane emojis
  - Add inline editing for swimlane names
  - Emoji picker for swimlane customization
  - Save custom swimlane configurations

### Authentication & Security
- [ ] Implement PocketID email recognition on login page
  - Smart login form that detects PocketID users
  - Show PocketID button for recognized emails
  - Fall back to password for non-PocketID users

- [ ] Add mandatory passkey setup with reminder system
  - Force passkey enrollment on first login
  - "Don't remind me" option with database tracking
  - Graceful fallback to password authentication

## 💰 SaaS Features (Private Repo Only)

### Billing & Subscriptions
- [ ] Create subscription tier enforcement in project creation
  - Check project limits based on subscription tier
  - Show upgrade prompts when limits reached
  - Implement usage tracking

- [ ] Add upgrade buttons and billing UI components
  - Create pricing tier comparison
  - Implement Stripe checkout integration
  - Add billing management dashboard

## ✅ Recently Completed
- [x] Add subscription fields to users table (subscription_tier, subscription_expires, stripe_customer_id)
- [x] Design badge system for open source vs SaaS deployment modes
- [x] Create Docker configurations for different deployment modes
- [x] Remove SaaS billing features from OSS repo
- [x] Keep only Open Source badge by default
- [x] Create merge strategy guide for OSS to private repo
- [x] Fix PocketID signup integration to send actual invitation emails
- [x] Add comprehensive PocketID signup integration
- [x] Add professional landing page with pricing and PocketID integration
- [x] Fix mobile formatting for settings dialog and user management
- [x] Simplify CI/CD pipeline and remove complex testing

## 🎯 Future Enhancements
- [ ] Add real-time collaboration features
- [ ] Implement advanced project analytics
- [ ] Add file attachment system
- [ ] Create mobile app
- [ ] Add API for third-party integrations
- [ ] Implement advanced search and filtering
- [ ] Add project templates
- [ ] Create admin dashboard for user management

## 🐛 Known Issues
- [ ] Mobile responsiveness needs improvement in some areas
- [ ] Performance optimization for large projects
- [ ] Better error handling for network failures

## 📝 Notes
- Open Source version should remain fully functional without billing restrictions
- SaaS features should be developed in private fork after core features are in OSS
- All new features should be developed in OSS repo first, then enhanced in SaaS repo
- Use GitHub fork sync to maintain both repositories

---

*Last updated: 2024-11-30*
*Priority: Focus on core functionality before advanced features*