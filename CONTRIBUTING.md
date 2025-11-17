# Contributing to n8n-nodes-sap-odata

Thank you for your interest in contributing! 🎉

## Quick Links

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Getting Started

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/YOUR-USERNAME/n8n-nodes-sap-odata.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`

## Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

## Making Changes

### Code Style

- Follow existing code patterns
- Use TypeScript strict mode
- Add JSDoc comments to public APIs (keep them short!)
- Run `npm run lint` before committing

### Commit Messages

Use conventional commits:
- `feat: Add new batch operation support`
- `fix: Handle CSRF token expiration`
- `docs: Update webhook examples`
- `refactor: Simplify error handling`

### Documentation

- Update README.md if adding new features
- Add examples to `docs/cookbook/`
- Update CHANGELOG.md

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

- Test files: `test/**/*.test.ts`
- Use descriptive test names
- Mock SAP backend calls
- Aim for 80%+ coverage

## Submitting Changes

1. **Push to your fork**: `git push origin feature/your-feature-name`
2. **Open a Pull Request** on GitHub
3. **Describe your changes**:
   - What problem does it solve?
   - How was it tested?
   - Any breaking changes?

## Code Review Process

- PRs require at least one approval
- CI/CD must pass (build + tests + lint)
- Documentation must be updated
- Changelog entry required

## Getting Help

- GitHub Issues: Bug reports & feature requests
- Discussions: Questions & ideas
- Discord: Real-time chat (link in README)

## Code of Conduct

Be respectful, constructive, and collaborative.

---

**Thank you for contributing!** 🚀
