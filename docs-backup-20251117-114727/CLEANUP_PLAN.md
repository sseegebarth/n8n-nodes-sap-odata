# Markdown Documentation Cleanup Plan

## Problem
68 .md Dateien (56 im Root) - zu viel für sauberes npm Package

## Ziel
**8 essenzielle Dateien** im Root + organisierte docs/ Struktur

---

## ✅ KEEP (Im Root - für npm Package)

### 1. Essenzielle User Docs
- **README.md** - Haupt-Dokumentation (Installation, Quick Start)
- **CHANGELOG.md** - Version History
- **DEPLOYMENT.md** - Deployment Guide (neu erstellt)
- **SECURITY.md** - Security Best Practices

### 2. Developer Docs
- **CONTRIBUTING.md** (neu erstellen - Guidelines für Contributors)
- **ARCHITECTURE.md** - Code-Struktur Overview
- **LICENSE** (falls noch nicht vorhanden)

### 3. Spezial
- **CODE_HUMANIZATION_GUIDE.md** - Intern, aber nützlich

**TOTAL: 8 Dateien im Root**

---

## 📦 MOVE TO docs/ (Organisiert für Entwickler)

### docs/guides/ (User-facing)
✓ **Bereits gut organisiert**
- docs/SAP_INTEGRATION_GUIDE.md
- docs/cookbook/*.md (7 Dateien)
- docs/CLEAN_CORE_MIGRATION.md

### docs/features/ (NEU - Feature-Dokumentation)
**Verschieben:**
- SAP_FEATURES_DOCUMENTATION.md → docs/features/overview.md
- SAP_GATEWAY_COMPATIBILITY.md → docs/features/gateway-compatibility.md
- SAP_GATEWAY_QUICK_REFERENCE.md → docs/features/gateway-reference.md
- WEBHOOK_GUIDE.md → docs/features/webhooks.md
- BATCH_IMPLEMENTATION_GUIDE.md → docs/features/batch-operations.md
- CONNECTION_POOLING.md → docs/features/connection-pooling.md
- PUBLIC_ODATA_SERVICES.md → docs/features/public-services.md
- QUICK_REFERENCE.md → docs/features/quick-reference.md
- STRATEGY_PATTERN.md → docs/features/strategy-pattern.md
- TEST_GUIDE.md → docs/features/testing.md
- ABAP_SETUP_GUIDE.md → docs/guides/abap-setup.md

### docs/development/ (NEU - Für Contributors)
**Verschieben:**
- DOCUMENTATION.md → docs/development/writing-docs.md
- N8N_COMPLIANCE_REPORT.md → docs/development/n8n-compliance.md

---

## 📚 ARCHIVE (docs/archive/ - Historie, nicht published)

**Session/Implementation Docs (für deine Referenz):**
```
docs/archive/sessions/
├── SESSION_SUMMARY.md
├── FINAL_SESSION_SUMMARY.md
├── CRITICAL_FIXES_SESSION2.md
└── ARCHITECTURAL_IMPROVEMENTS_SESSION3.md

docs/archive/implementation/
├── PHASE_3_IMPLEMENTATION_SUMMARY.md
├── PHASE_7_SAP_GATEWAY_IMPLEMENTATION.md
├── PHASES_8-10_IMPLEMENTATION_SUMMARY.md
├── AUTO_DISCOVERY_IMPLEMENTATION.md
├── CONNECTION_POOLING_IMPLEMENTATION.md
└── ARCHITECTURE_REFACTORING_COMPLETE.md

docs/archive/analysis/
├── CODEBASE_ANALYSIS.md
├── COMPREHENSIVE_EXPERT_ANALYSIS.md
├── EXPERT_ANALYSIS.md
├── FEATURE_COMPLETENESS_ANALYSIS.md
└── BASELINE_METRICS.md

docs/archive/code-review/
├── CODE_REVIEW_COMPLETE_SUMMARY.md
├── CODE_REVIEW_IMPROVEMENTS.md
└── CODE_REVIEW_PHASE_8_9.md

docs/archive/improvements/
├── CODE_QUALITY_IMPROVEMENTS.md
├── CODE_QUALITY_FIXES.md
├── IMPROVEMENTS_IMPLEMENTED.md
├── IMPROVEMENT_SUMMARY.md
├── CRITICAL_ISSUES_FIXED.md
└── ESLINT_IMPROVEMENTS.md

docs/archive/planning/
├── REFACTORING_PLAN.md
├── REFACTORING_CHECKLIST.md
├── REFACTORING_STATUS.md
├── RETRY_THROTTLING_PLAN.md
└── TODO_LIST.md
```

---

## 🗑️ DELETE (Duplikate/Obsolet)

**Sofort löschen:**
- improvements.md (duplikat)
- new_improv.md (duplikat)
- codex.md (?)
- next_steps_suggestions.md (obsolet)
- next_steps_suggestions_n8n_compliant.md (obsolet)
- FINDINGS_SUMMARY.md (duplikat zu anderen summaries)
- ANALYSIS_INDEX.md (obsolet)
- SECURITY_FIX_CREDENTIAL_ISOLATION.md (Teil von CODE_QUALITY_IMPROVEMENTS)

**Total: 8 Dateien löschen**

---

## 📁 Finale Struktur

```
n8n-nodes-sap-odata/
├── README.md                       # Installation & Quick Start
├── CHANGELOG.md                    # Version History
├── CONTRIBUTING.md                 # Contributor Guidelines (NEU)
├── LICENSE                         # MIT License
├── ARCHITECTURE.md                 # High-level Overview
├── SECURITY.md                     # Security Best Practices
├── DEPLOYMENT.md                   # Deployment Guide
├── CODE_HUMANIZATION_GUIDE.md      # Für Contributors (optional)
│
├── docs/
│   ├── README.md                   # Docs Navigation
│   │
│   ├── guides/                     # User Guides
│   │   ├── SAP_INTEGRATION_GUIDE.md
│   │   ├── CLEAN_CORE_MIGRATION.md
│   │   └── abap-setup.md
│   │
│   ├── cookbook/                   # How-To Examples
│   │   ├── README.md
│   │   ├── 01-basic-operations.md
│   │   ├── 02-filtering-sorting.md
│   │   ├── 03-function-imports.md
│   │   ├── 04-pagination.md
│   │   ├── 05-error-handling.md
│   │   └── 06-monitoring.md
│   │
│   ├── features/                   # Feature Documentation
│   │   ├── overview.md
│   │   ├── gateway-compatibility.md
│   │   ├── webhooks.md
│   │   ├── batch-operations.md
│   │   ├── connection-pooling.md
│   │   └── testing.md
│   │
│   ├── development/                # For Contributors
│   │   ├── writing-docs.md
│   │   └── n8n-compliance.md
│   │
│   └── archive/                    # Historical (nicht published)
│       ├── sessions/
│       ├── implementation/
│       ├── analysis/
│       ├── code-review/
│       ├── improvements/
│       └── planning/
│
├── examples/
│   └── README.md
│
└── workflows/
    └── README.md
```

---

## 🎯 Ergebnis

**VORHER:**
- 68 Markdown-Dateien total
- 56 im Root (chaotisch)
- Schwer zu navigieren

**NACHHER:**
- 8 Dateien im Root (essentiell)
- 25 Dateien in docs/ (organisiert)
- 35 Dateien archiviert (optional)
- 8 Dateien gelöscht

**npm Package enthält:**
- Nur Root-Dateien (8)
- docs/guides/, docs/cookbook/, docs/features/ (~20 Dateien)
- examples/ (1)
- workflows/ (1)

**Total im Package: ~30 Dateien** (von 68)

---

## .npmignore Update

```
# Archive - nicht publishen
docs/archive/

# Internal development docs
CODE_HUMANIZATION_GUIDE.md

# Development files
*.log
coverage/
test/
```

---

## Automatisches Cleanup Script

Siehe: `scripts/cleanup-docs.sh`
