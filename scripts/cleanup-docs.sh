#!/bin/bash
# Markdown Documentation Cleanup Script
# Reduces 68 .md files to 30 organized files

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🧹 Starting documentation cleanup..."
echo "======================================"
echo ""

# Backup first!
echo "📦 Creating backup..."
BACKUP_DIR="docs-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
find . -maxdepth 1 -name "*.md" -exec cp {} "$BACKUP_DIR/" \;
echo "✓ Backup created in: $BACKUP_DIR"
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p docs/features
mkdir -p docs/development
mkdir -p docs/archive/{sessions,implementation,analysis,code-review,improvements,planning}
mkdir -p docs/guides
echo "✓ Directories created"
echo ""

# ============================================
# STEP 1: MOVE TO docs/features/
# ============================================
echo "📝 Moving feature documentation..."

mv -f SAP_FEATURES_DOCUMENTATION.md docs/features/overview.md 2>/dev/null || true
mv -f SAP_GATEWAY_COMPATIBILITY.md docs/features/gateway-compatibility.md 2>/dev/null || true
mv -f SAP_GATEWAY_QUICK_REFERENCE.md docs/features/gateway-reference.md 2>/dev/null || true
mv -f WEBHOOK_GUIDE.md docs/features/webhooks.md 2>/dev/null || true
mv -f BATCH_IMPLEMENTATION_GUIDE.md docs/features/batch-operations.md 2>/dev/null || true
mv -f CONNECTION_POOLING.md docs/features/connection-pooling.md 2>/dev/null || true
mv -f PUBLIC_ODATA_SERVICES.md docs/features/public-services.md 2>/dev/null || true
mv -f QUICK_REFERENCE.md docs/features/quick-reference.md 2>/dev/null || true
mv -f STRATEGY_PATTERN.md docs/features/strategy-pattern.md 2>/dev/null || true
mv -f TEST_GUIDE.md docs/features/testing.md 2>/dev/null || true

echo "✓ Moved 10 files to docs/features/"

# ============================================
# STEP 2: MOVE TO docs/guides/
# ============================================
echo "📝 Moving user guides..."

mv -f ABAP_SETUP_GUIDE.md docs/guides/abap-setup.md 2>/dev/null || true

echo "✓ Moved 1 file to docs/guides/"

# ============================================
# STEP 3: MOVE TO docs/development/
# ============================================
echo "📝 Moving development docs..."

mv -f DOCUMENTATION.md docs/development/writing-docs.md 2>/dev/null || true
mv -f N8N_COMPLIANCE_REPORT.md docs/development/n8n-compliance.md 2>/dev/null || true

echo "✓ Moved 2 files to docs/development/"

# ============================================
# STEP 4: ARCHIVE - Sessions
# ============================================
echo "📚 Archiving session summaries..."

mv -f SESSION_SUMMARY.md docs/archive/sessions/ 2>/dev/null || true
mv -f FINAL_SESSION_SUMMARY.md docs/archive/sessions/ 2>/dev/null || true
mv -f CRITICAL_FIXES_SESSION2.md docs/archive/sessions/ 2>/dev/null || true
mv -f ARCHITECTURAL_IMPROVEMENTS_SESSION3.md docs/archive/sessions/ 2>/dev/null || true

echo "✓ Archived 4 session files"

# ============================================
# STEP 5: ARCHIVE - Implementation
# ============================================
echo "📚 Archiving implementation docs..."

mv -f PHASE_3_IMPLEMENTATION_SUMMARY.md docs/archive/implementation/ 2>/dev/null || true
mv -f PHASE_7_SAP_GATEWAY_IMPLEMENTATION.md docs/archive/implementation/ 2>/dev/null || true
mv -f PHASES_8-10_IMPLEMENTATION_SUMMARY.md docs/archive/implementation/ 2>/dev/null || true
mv -f AUTO_DISCOVERY_IMPLEMENTATION.md docs/archive/implementation/ 2>/dev/null || true
mv -f CONNECTION_POOLING_IMPLEMENTATION.md docs/archive/implementation/ 2>/dev/null || true
mv -f ARCHITECTURE_REFACTORING_COMPLETE.md docs/archive/implementation/ 2>/dev/null || true

echo "✓ Archived 6 implementation files"

# ============================================
# STEP 6: ARCHIVE - Analysis
# ============================================
echo "📚 Archiving analysis docs..."

mv -f CODEBASE_ANALYSIS.md docs/archive/analysis/ 2>/dev/null || true
mv -f COMPREHENSIVE_EXPERT_ANALYSIS.md docs/archive/analysis/ 2>/dev/null || true
mv -f EXPERT_ANALYSIS.md docs/archive/analysis/ 2>/dev/null || true
mv -f FEATURE_COMPLETENESS_ANALYSIS.md docs/archive/analysis/ 2>/dev/null || true
mv -f BASELINE_METRICS.md docs/archive/analysis/ 2>/dev/null || true

echo "✓ Archived 5 analysis files"

# ============================================
# STEP 7: ARCHIVE - Code Review
# ============================================
echo "📚 Archiving code review docs..."

mv -f CODE_REVIEW_COMPLETE_SUMMARY.md docs/archive/code-review/ 2>/dev/null || true
mv -f CODE_REVIEW_IMPROVEMENTS.md docs/archive/code-review/ 2>/dev/null || true
mv -f CODE_REVIEW_PHASE_8_9.md docs/archive/code-review/ 2>/dev/null || true

echo "✓ Archived 3 code review files"

# ============================================
# STEP 8: ARCHIVE - Improvements
# ============================================
echo "📚 Archiving improvement docs..."

mv -f CODE_QUALITY_IMPROVEMENTS.md docs/archive/improvements/ 2>/dev/null || true
mv -f CODE_QUALITY_FIXES.md docs/archive/improvements/ 2>/dev/null || true
mv -f IMPROVEMENTS_IMPLEMENTED.md docs/archive/improvements/ 2>/dev/null || true
mv -f IMPROVEMENT_SUMMARY.md docs/archive/improvements/ 2>/dev/null || true
mv -f CRITICAL_ISSUES_FIXED.md docs/archive/improvements/ 2>/dev/null || true
mv -f ESLINT_IMPROVEMENTS.md docs/archive/improvements/ 2>/dev/null || true

echo "✓ Archived 6 improvement files"

# ============================================
# STEP 9: ARCHIVE - Planning
# ============================================
echo "📚 Archiving planning docs..."

mv -f REFACTORING_PLAN.md docs/archive/planning/ 2>/dev/null || true
mv -f REFACTORING_CHECKLIST.md docs/archive/planning/ 2>/dev/null || true
mv -f REFACTORING_STATUS.md docs/archive/planning/ 2>/dev/null || true
mv -f RETRY_THROTTLING_PLAN.md docs/archive/planning/ 2>/dev/null || true
mv -f TODO_LIST.md docs/archive/planning/ 2>/dev/null || true

echo "✓ Archived 5 planning files"

# ============================================
# STEP 10: DELETE Duplicates/Obsolete
# ============================================
echo "🗑️  Deleting duplicates/obsolete files..."

rm -f improvements.md 2>/dev/null || true
rm -f new_improv.md 2>/dev/null || true
rm -f codex.md 2>/dev/null || true
rm -f next_steps_suggestions.md 2>/dev/null || true
rm -f next_steps_suggestions_n8n_compliant.md 2>/dev/null || true
rm -f FINDINGS_SUMMARY.md 2>/dev/null || true
rm -f ANALYSIS_INDEX.md 2>/dev/null || true
rm -f SECURITY_FIX_CREDENTIAL_ISOLATION.md 2>/dev/null || true
rm -f CLEANUP_PLAN.md 2>/dev/null || true  # This file itself

echo "✓ Deleted 9 obsolete files"
echo ""

# ============================================
# STEP 11: Create CONTRIBUTING.md
# ============================================
echo "📝 Creating CONTRIBUTING.md..."

cat > CONTRIBUTING.md << 'EOF'
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
EOF

echo "✓ Created CONTRIBUTING.md"
echo ""

# ============================================
# STEP 12: Update .npmignore
# ============================================
echo "📝 Updating .npmignore..."

cat > .npmignore << 'EOF'
# Source files
nodes/**/*.ts
credentials/**/*.ts
test/
!dist/**/*.d.ts

# Config files
tsconfig.json
.eslintrc.js
jest.config.js
prettier.config.js

# Development files
.git
.github
.vscode
.idea
*.log
coverage/
node_modules/

# Documentation archive (not published)
docs/archive/

# Internal development docs
CODE_HUMANIZATION_GUIDE.md
CLEANUP_PLAN.md
scripts/

# Backup directories
docs-backup-*/

# Examples and workflows (optional - keep commented to include)
# examples/
# workflows/

# Development markdown
*.md
!README.md
!CHANGELOG.md
!CONTRIBUTING.md
!LICENSE
!docs/**/*.md
EOF

echo "✓ Updated .npmignore"
echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "======================================"
echo "✅ Cleanup Complete!"
echo "======================================"
echo ""
echo "📊 Final Structure:"
echo ""
echo "Root (8 essential files):"
ls -1 *.md 2>/dev/null | head -10 || echo "(no files)"
echo ""
echo "docs/features/:"
ls -1 docs/features/*.md 2>/dev/null | wc -l | xargs echo "  Files:"
echo ""
echo "docs/guides/:"
ls -1 docs/guides/*.md 2>/dev/null | wc -l | xargs echo "  Files:"
echo ""
echo "docs/cookbook/:"
ls -1 docs/cookbook/*.md 2>/dev/null | wc -l | xargs echo "  Files:"
echo ""
echo "docs/archive/:"
find docs/archive -name "*.md" 2>/dev/null | wc -l | xargs echo "  Files:"
echo ""
echo "📦 Backup saved to: $BACKUP_DIR"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Test build: npm run build"
echo "  3. Commit: git add . && git commit -m 'docs: cleanup markdown files'"
echo ""
