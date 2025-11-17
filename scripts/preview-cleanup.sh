#!/bin/bash
# Preview what cleanup-docs.sh would do (DRY RUN)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🔍 CLEANUP PREVIEW (Dry Run)"
echo "============================================"
echo ""
echo "Current state: $(find . -maxdepth 1 -name "*.md" | wc -l) markdown files in root"
echo ""

# Helper function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ $1"
        return 0
    else
        echo "  ✗ $1 (not found)"
        return 1
    fi
}

# COUNT FILES
KEEP_COUNT=0
MOVE_COUNT=0
ARCHIVE_COUNT=0
DELETE_COUNT=0

echo "📌 KEEP in root (8 files):"
echo "─────────────────────────"
check_file "README.md" && ((KEEP_COUNT++))
check_file "CHANGELOG.md" && ((KEEP_COUNT++))
check_file "SECURITY.md" && ((KEEP_COUNT++))
check_file "ARCHITECTURE.md" && ((KEEP_COUNT++))
check_file "DEPLOYMENT.md" && ((KEEP_COUNT++))
check_file "CODE_HUMANIZATION_GUIDE.md" && ((KEEP_COUNT++))
echo "  → CONTRIBUTING.md (will be created)"
echo "  → LICENSE (should exist)"
echo ""
echo "Total kept: $KEEP_COUNT existing + 2 new = 8 files"
echo ""

echo "📁 MOVE to docs/features/ (10 files):"
echo "─────────────────────────────────────"
check_file "SAP_FEATURES_DOCUMENTATION.md" && ((MOVE_COUNT++))
check_file "SAP_GATEWAY_COMPATIBILITY.md" && ((MOVE_COUNT++))
check_file "SAP_GATEWAY_QUICK_REFERENCE.md" && ((MOVE_COUNT++))
check_file "WEBHOOK_GUIDE.md" && ((MOVE_COUNT++))
check_file "BATCH_IMPLEMENTATION_GUIDE.md" && ((MOVE_COUNT++))
check_file "CONNECTION_POOLING.md" && ((MOVE_COUNT++))
check_file "PUBLIC_ODATA_SERVICES.md" && ((MOVE_COUNT++))
check_file "QUICK_REFERENCE.md" && ((MOVE_COUNT++))
check_file "STRATEGY_PATTERN.md" && ((MOVE_COUNT++))
check_file "TEST_GUIDE.md" && ((MOVE_COUNT++))
echo ""
echo "Total moved to features: $MOVE_COUNT files"
echo ""

echo "📁 MOVE to docs/guides/ (1 file):"
echo "──────────────────────────────────"
check_file "ABAP_SETUP_GUIDE.md" && ((MOVE_COUNT++))
echo ""

echo "📁 MOVE to docs/development/ (2 files):"
echo "────────────────────────────────────────"
check_file "DOCUMENTATION.md" && ((MOVE_COUNT++))
check_file "N8N_COMPLIANCE_REPORT.md" && ((MOVE_COUNT++))
echo ""
echo "Total moved to organized docs: $MOVE_COUNT files"
echo ""

echo "📚 ARCHIVE to docs/archive/ (35+ files):"
echo "─────────────────────────────────────────"

echo "  Sessions (4):"
check_file "SESSION_SUMMARY.md" && ((ARCHIVE_COUNT++))
check_file "FINAL_SESSION_SUMMARY.md" && ((ARCHIVE_COUNT++))
check_file "CRITICAL_FIXES_SESSION2.md" && ((ARCHIVE_COUNT++))
check_file "ARCHITECTURAL_IMPROVEMENTS_SESSION3.md" && ((ARCHIVE_COUNT++))
echo ""

echo "  Implementation (6):"
check_file "PHASE_3_IMPLEMENTATION_SUMMARY.md" && ((ARCHIVE_COUNT++))
check_file "PHASE_7_SAP_GATEWAY_IMPLEMENTATION.md" && ((ARCHIVE_COUNT++))
check_file "PHASES_8-10_IMPLEMENTATION_SUMMARY.md" && ((ARCHIVE_COUNT++))
check_file "AUTO_DISCOVERY_IMPLEMENTATION.md" && ((ARCHIVE_COUNT++))
check_file "CONNECTION_POOLING_IMPLEMENTATION.md" && ((ARCHIVE_COUNT++))
check_file "ARCHITECTURE_REFACTORING_COMPLETE.md" && ((ARCHIVE_COUNT++))
echo ""

echo "  Analysis (5):"
check_file "CODEBASE_ANALYSIS.md" && ((ARCHIVE_COUNT++))
check_file "COMPREHENSIVE_EXPERT_ANALYSIS.md" && ((ARCHIVE_COUNT++))
check_file "EXPERT_ANALYSIS.md" && ((ARCHIVE_COUNT++))
check_file "FEATURE_COMPLETENESS_ANALYSIS.md" && ((ARCHIVE_COUNT++))
check_file "BASELINE_METRICS.md" && ((ARCHIVE_COUNT++))
echo ""

echo "  Code Review (3):"
check_file "CODE_REVIEW_COMPLETE_SUMMARY.md" && ((ARCHIVE_COUNT++))
check_file "CODE_REVIEW_IMPROVEMENTS.md" && ((ARCHIVE_COUNT++))
check_file "CODE_REVIEW_PHASE_8_9.md" && ((ARCHIVE_COUNT++))
echo ""

echo "  Improvements (6):"
check_file "CODE_QUALITY_IMPROVEMENTS.md" && ((ARCHIVE_COUNT++))
check_file "CODE_QUALITY_FIXES.md" && ((ARCHIVE_COUNT++))
check_file "IMPROVEMENTS_IMPLEMENTED.md" && ((ARCHIVE_COUNT++))
check_file "IMPROVEMENT_SUMMARY.md" && ((ARCHIVE_COUNT++))
check_file "CRITICAL_ISSUES_FIXED.md" && ((ARCHIVE_COUNT++))
check_file "ESLINT_IMPROVEMENTS.md" && ((ARCHIVE_COUNT++))
echo ""

echo "  Planning (5):"
check_file "REFACTORING_PLAN.md" && ((ARCHIVE_COUNT++))
check_file "REFACTORING_CHECKLIST.md" && ((ARCHIVE_COUNT++))
check_file "REFACTORING_STATUS.md" && ((ARCHIVE_COUNT++))
check_file "RETRY_THROTTLING_PLAN.md" && ((ARCHIVE_COUNT++))
check_file "TODO_LIST.md" && ((ARCHIVE_COUNT++))
echo ""
echo "Total archived: $ARCHIVE_COUNT files"
echo ""

echo "🗑️  DELETE (duplicates/obsolete) (9 files):"
echo "────────────────────────────────────────────"
check_file "improvements.md" && ((DELETE_COUNT++))
check_file "new_improv.md" && ((DELETE_COUNT++))
check_file "codex.md" && ((DELETE_COUNT++))
check_file "next_steps_suggestions.md" && ((DELETE_COUNT++))
check_file "next_steps_suggestions_n8n_compliant.md" && ((DELETE_COUNT++))
check_file "FINDINGS_SUMMARY.md" && ((DELETE_COUNT++))
check_file "ANALYSIS_INDEX.md" && ((DELETE_COUNT++))
check_file "SECURITY_FIX_CREDENTIAL_ISOLATION.md" && ((DELETE_COUNT++))
check_file "CLEANUP_PLAN.md" && ((DELETE_COUNT++))
echo ""
echo "Total deleted: $DELETE_COUNT files"
echo ""

# Summary
echo "============================================"
echo "📊 SUMMARY"
echo "============================================"
echo ""
echo "Current root .md files: $(find . -maxdepth 1 -name "*.md" | wc -l)"
echo ""
echo "After cleanup:"
echo "  ✓ Keep in root:        8 files"
echo "  → Move to docs/:       $MOVE_COUNT files"
echo "  📚 Archive:            $ARCHIVE_COUNT files"
echo "  🗑️  Delete:             $DELETE_COUNT files"
echo ""
echo "Final npm package size:"
echo "  Root docs:             8 files"
echo "  docs/guides:           ~4 files"
echo "  docs/cookbook:         ~7 files"
echo "  docs/features:         ~10 files"
echo "  docs/development:      ~2 files"
echo "  ─────────────────────────────"
echo "  Total published:       ~31 files"
echo ""
echo "📁 Final root structure:"
find . -maxdepth 1 -name "*.md" | sort | sed 's|./||' | while read file; do
    if [ "$file" = "README.md" ] || [ "$file" = "CHANGELOG.md" ] || \
       [ "$file" = "SECURITY.md" ] || [ "$file" = "ARCHITECTURE.md" ] || \
       [ "$file" = "DEPLOYMENT.md" ] || [ "$file" = "CODE_HUMANIZATION_GUIDE.md" ]; then
        echo "  ✓ KEEP: $file"
    else
        echo "  ✗ REMOVE: $file"
    fi
done
echo ""
echo "============================================"
echo ""
echo "To execute cleanup:"
echo "  bash scripts/cleanup-docs.sh"
echo ""
echo "This will:"
echo "  1. Create backup in docs-backup-<timestamp>/"
echo "  2. Move/archive/delete files as shown above"
echo "  3. Create CONTRIBUTING.md"
echo "  4. Update .npmignore"
echo ""
