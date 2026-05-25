# Contributing to kAInban

Thank you for your interest in contributing to kAInban! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [License](#license)

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin contributing, make sure you have:

- **Node.js** (version 18 or higher)
- **Docker** and **Docker Compose**
- **Git**
- Basic knowledge of React, JavaScript, and Node.js

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/notes.git
   cd notes
   ```
3. Add the original repository as upstream:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/notes.git
   ```

## Development Setup

### Environment Configuration

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure your environment variables:
   ```bash
   # Azure OpenAI Configuration (required for AI features)
   VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   VITE_AZURE_OPENAI_API_KEY=your-api-key
   VITE_AZURE_OPENAI_API_VERSION=2024-02-01
   VITE_AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
   VITE_AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4

   # Zitadel OIDC (optional locally - leave unset to disable hosted login
   # and use the local-auth fallback for development)
   # ZITADEL_ISSUER=https://your-zitadel-instance.example.com
   # ZITADEL_CLIENT_ID=your-pkce-client-id
   # OIDC_CALLBACK_URL=http://localhost:3001/api/auth/oidc/callback
   # ZITADEL_BOOTSTRAP_ADMIN_EMAILS=admin@example.com

   # Local-auth fallback for development (re-opens /api/auth/login + /register)
   LOCAL_LOGIN_FALLBACK=true
   LOCAL_REGISTER_FALLBACK=true

   # Registration Control
   ALLOW_REGISTRATION=true
   ```

   For local development, the simplest path is to leave the `ZITADEL_*`
   vars unset and rely on `LOCAL_LOGIN_FALLBACK=true` so you can register
   and log in with email + password. To exercise the OIDC flow locally,
   point `ZITADEL_*` at your Zitadel dev instance and add the localhost
   callback URI to the application's redirect-URI list in Zitadel.

### Running the Application

1. **Development Mode** (with hot reload):
   ```bash
   # Start all services
   docker compose up -d

   # View logs
   docker compose logs -f
   ```

2. **Production Mode**:
   ```bash
   # Build and start
   docker compose up -d --build
   ```

3. **Frontend Development** (standalone):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Backend Development** (standalone):
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database**: SQLite file at `./storage/app.db`

## How to Contribute

### Types of Contributions

We welcome contributions in the form of:

- **Bug fixes**
- **Feature enhancements**
- **Documentation improvements**
- **UI/UX improvements**
- **Performance optimizations**
- **Test coverage improvements**
- **Translation/localization**

### Areas for Contribution

#### Frontend (React + Vite)
- Component improvements
- UI/UX enhancements
- Performance optimizations
- Accessibility improvements
- Mobile responsiveness

#### Backend (Node.js + Express)
- API enhancements
- Database optimizations
- Authentication improvements
- Security enhancements

#### AI Integration
- OpenAI service improvements
- Task extraction algorithms
- Analytics and insights
- Audio processing enhancements

#### Infrastructure
- Docker improvements
- CI/CD pipeline
- Deployment optimizations
- Monitoring and logging

## Coding Standards

### JavaScript/React Guidelines

- Use **ES6+** features and modern JavaScript
- Follow **functional programming** patterns where possible
- Use **hooks** instead of class components
- Implement **proper error handling**
- Write **descriptive variable and function names**

### Code Style

```javascript
// ✅ Good
const handleTaskCreation = async (taskData) => {
  try {
    const newTask = await createTask(taskData)
    addNotification({
      type: 'success',
      message: 'Task created successfully'
    })
    return newTask
  } catch (error) {
    console.error('Task creation failed:', error)
    addNotification({
      type: 'error',
      message: 'Failed to create task'
    })
  }
}

// ❌ Avoid
const create = (data) => {
  createTask(data).then(task => {
    // success logic
  }).catch(err => {
    // error logic
  })
}
```

### Component Structure

```jsx
// Component file structure
import React, { useState, useEffect } from 'react'
import { ComponentName } from './ui/component-name'
import useAppStore from '../stores/useAppStore'

export default function ComponentName({ prop1, prop2 }) {
  // Hooks first
  const [localState, setLocalState] = useState('')
  const globalState = useAppStore((state) => state.someValue)

  // Effects
  useEffect(() => {
    // effect logic
  }, [])

  // Event handlers
  const handleEvent = () => {
    // handler logic
  }

  // Early returns
  if (!prop1) return null

  // Render
  return (
    <div className="component-class">
      {/* JSX content */}
    </div>
  )
}
```

### CSS/Styling

- Use **Tailwind CSS** classes
- Follow **mobile-first** responsive design
- Maintain **consistent spacing** and **color scheme**
- Use **CSS Grid** and **Flexbox** for layouts

### Backend Guidelines

- Use **async/await** instead of callbacks
- Implement **proper error handling** with try/catch
- Use **middleware** for common functionality
- Follow **RESTful API** conventions
- Validate **input data** before processing

```javascript
// ✅ Good API endpoint
app.post('/api/tasks', authenticateUser, async (req, res) => {
  try {
    const { title, description } = req.body

    if (!title?.trim()) {
      return res.status(400).json({
        error: 'Task title is required'
      })
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim(),
      userId: req.user.id
    })

    res.status(201).json({ task })
  } catch (error) {
    console.error('Task creation error:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
})
```

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Run tests and linting**:
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Test your changes thoroughly**:
   - Test in both development and production modes
   - Test on different screen sizes
   - Test with and without AI features enabled
   - Test authentication flows

### Pull Request Template

When submitting a PR, please include:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Tested locally in development mode
- [ ] Tested locally in production mode
- [ ] Tested on mobile devices
- [ ] Added/updated tests if applicable

## Screenshots (if applicable)
Include before/after screenshots for UI changes.

## Checklist
- [ ] Code follows the style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated if needed
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** must pass (linting, tests, build)
2. **Code review** by maintainers
3. **Testing** by reviewers
4. **Approval** required before merging
5. **Squash and merge** preferred for clean history

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

```markdown
**Describe the Bug**
Clear description of the issue.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. macOS, Windows, Linux]
- Browser: [e.g. Chrome, Firefox, Safari]
- Version: [e.g. 1.1.1]
- Docker Version: [e.g. 20.10.0]

**Additional Context**
Any other context about the problem.
```

### Feature Requests

```markdown
**Feature Description**
Clear description of the feature.

**Problem Statement**
What problem would this solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Mockups, examples, or references.
```

## Development Guidelines

### Database Changes

- Use **migration scripts** for schema changes
- Test migrations on sample data
- Document any breaking changes

### Security Considerations

- **Never commit** sensitive data (API keys, passwords)
- **Validate input** on both client and server
- **Sanitize output** to prevent XSS
- **Use HTTPS** in production
- **Follow OWASP** security guidelines

### Performance

- **Optimize images** and assets
- **Minimize bundle size**
- **Use lazy loading** where appropriate
- **Implement caching** strategies
- **Profile performance** before/after changes

### Accessibility

- Use **semantic HTML** elements
- Provide **alt text** for images
- Ensure **keyboard navigation** works
- Test with **screen readers**
- Maintain **color contrast** standards

### Testing

- Write **unit tests** for utility functions
- Add **integration tests** for API endpoints
- Test **component behavior** thoroughly
- Include **error scenarios** in tests

## Documentation

### Code Documentation

- Add **JSDoc comments** for complex functions
- Document **API endpoints** thoroughly
- Update **README** for setup changes
- Maintain **architecture documentation**

### Inline Comments

```javascript
// ✅ Good - explains why, not what
// Cache insights daily to reduce API calls and improve performance
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// ❌ Avoid - explains what the code does
// Set cache duration to 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000
```

## Release Process

### Version Numbering

We follow **Semantic Versioning** (semver):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Changelog

Maintain `CHANGELOG.md` with:
- **Added** features
- **Changed** functionality
- **Deprecated** features
- **Removed** features
- **Fixed** bugs
- **Security** improvements

## Community

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Discord/Slack**: Real-time community chat (if available)

### Recognition

Contributors will be recognized in:
- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **Special mentions** in documentation

## License

By contributing to kAInban, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0**.

This means:
- Your code will be **open source**
- Derivative works must **also be open source**
- **Network use** constitutes distribution (AGPL requirement)
- You retain **copyright** of your contributions
- You grant **irrevocable license** to the project

## Questions?

If you have questions about contributing:

1. Check existing **documentation**
2. Search **closed issues** for similar questions
3. Open a new **discussion** or **issue**
4. Reach out to **maintainers** directly

Thank you for contributing to kAInban! 🎉