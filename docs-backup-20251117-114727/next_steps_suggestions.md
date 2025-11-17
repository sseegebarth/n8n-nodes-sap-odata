# Vorschläge für nächste Schritte nach Perspektive

| Perspektive | Bereich | Thema | Verbesserung |
| --- | --- | --- | --- |
| n8n Developer | Node UX | Geführter Verbindungsassistent | Implementiere einen geführten Wizard, der Credentials testet, Servicekatalog lädt und die Node automatisch mit Entity Sets/Operationen vorkonfiguriert. |
| n8n Developer | Monitoring | Ausführungs-Telemetrie | Ergänze optionale Workflow-Telemetrie (z. B. Prometheus/Influx Hooks) für Request-Dauer, Retry-Zählung und Throttling-Ereignisse. |
| n8n Developer | Testing | Workflow-Snapshots | Baue generische Snapshot-Tests für Standard-Workflows (Create/GetAll/FunctionImport), um Regressionen in Releases schneller zu erkennen. |
| SAP Developer | Integrationsumfang | OData Batch & $batch | Füge Unterstützung für SAP OData Batch-Requests hinzu, inklusive Multipart-Encoding und Transaktionssteuerung. |
| SAP Developer | Authentifizierung | SSO & Principal Propagation | Implementiere optionale SAML-/OAuth2-Szenarien mit Principal Propagation zu Backend-Systemen für Enterprise-Landschaften. |
| SAP Developer | Datenmodell | Metadaten-Caching | Baue einen Hintergrundjob, der $metadata periodisch aktualisiert, Unterschiede diffed und Breaking Changes anzeigt. |
| Clean Code Expert | Codequalität | ESLint/TS-Project Ruleset | Ergänze ein erweitertes ESLint/TypeScript-Projekt-Setup (strict mode, import/order), um konsistente Codequalität sicherzustellen. |
| Clean Code Expert | Dokumentation | API Cookbook | Erstelle ein „SAP API Cookbook“ mit Step-by-Step-Beispielen (Pagination, $filter, Function Imports) direkt in der Repo-Doku. |
| Architect | Skalierung | Konfigurierbarer HTTP-Pool | Erweitere den ConnectionPoolManager um adaptive Limits (auto-scaling nach Fehlerquote/Latency) inklusive Telemetrie. |
| Architect | Verfügbarkeit | Circuit-Breaker Layer | Implementiere Circuit-Breaker/Kaskaden-Backoff, um SAP-Systeme bei Fehlerwellen automatisch zu entlasten. |
| Architect | Multi-Tenancy | Credential-Isolation | Plane eine Multi-Tenant-Architektur mit Namespace-Präfixen, getrennten Caches und Secret-Stores pro Mandant. |
