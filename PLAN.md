# Ausbauplan: "From List" Option im OData Knoten

## Aktuelle Situation

Die "From List" Option existiert an **drei Stellen** im OData-Knoten:

### 1. Service Path Mode (`servicePathMode = 'list'`)
- **Datei:** [SapODataProperties.ts:24-28](nodes/Sap/SapODataProperties.ts#L24-L28)
- **Load Option:** `getServicesByCategory()` in [SapODataLoadOptions.ts:86-167](nodes/Sap/SapODataLoadOptions.ts#L86-L167)
- **Kategorien:** All Services, SAP Standard APIs, Custom Services (Z*), Other Services
- **Datenquelle:** SAP Gateway Catalog Service oder Common Services Fallback

### 2. Entity Set Mode (`entitySetMode = 'list'`)
- **Datei:** [SapODataProperties.ts:210-213](nodes/Sap/SapODataProperties.ts#L210-L213)
- **Load Option:** `getEntitySets()` in [SapODataLoadOptions.ts:269-383](nodes/Sap/SapODataLoadOptions.ts#L269-L383)
- **Datenquelle:** `$metadata` des gewählten Services

### 3. Function Name Mode (`functionNameMode = 'list'`)
- **Datei:** [SapODataProperties.ts:703-706](nodes/Sap/SapODataProperties.ts#L703-L706)
- **Load Option:** `getFunctionImports()` in [SapODataLoadOptions.ts:386-442](nodes/Sap/SapODataLoadOptions.ts#L386-L442)
- **Datenquelle:** `$metadata` des gewählten Services

---

## Erweiterungsvorschläge

### Phase 1: Verbesserte Service-Kategorisierung

#### 1.1 Erweiterte Kategorien
**Aufwand:** Gering | **Nutzen:** Hoch

Neue Kategorien in [SapODataProperties.ts:64-85](nodes/Sap/SapODataProperties.ts#L64-L85):
- **"By Module"** - Gruppierung nach SAP-Modul (SD, MM, FI, HR, etc.)
- **"Recently Used"** - Zuletzt verwendete Services (aus Cache)
- **"Favorites"** - Vom User markierte Favoriten

**Änderungen:**
- `SapODataProperties.ts`: Neue Kategorieoptionen hinzufügen
- `DiscoveryService.ts`: Neue Gruppierungslogik implementieren
- `CacheManager.ts`: Recently Used + Favorites speichern

#### 1.2 Freitext-Suche in Service-Liste
**Aufwand:** Mittel | **Nutzen:** Hoch

Aktuell: Nur feste Kategoriefilter
Neu: Texteingabe zum Filtern der Service-Liste

**Änderungen:**
- Neues Property `serviceSearchText` (type: 'string')
- Erweiterung von `getServicesByCategory()` um Suchlogik
- Nutzung der existierenden `searchServices()` Funktion aus [DiscoveryService.ts:245-257](nodes/Sap/DiscoveryService.ts#L245-L257)

---

### Phase 2: Erweiterte Entity Set Informationen

#### 2.1 Entity Set Metadaten anzeigen
**Aufwand:** Mittel | **Nutzen:** Mittel

Aktuell: Nur Entity Set Name
Neu: Name + Anzahl Eigenschaften + Key-Felder + Beschreibung

**Änderungen:**
- `SapODataLoadOptions.ts`: Erweiterte Metadaten-Parsing
- `GenericFunctions.ts`: `parseMetadataForEntitySets()` erweitern
- Dropdown-Anzeige: `"SalesOrder (7 Keys, 45 Properties)"`

#### 2.2 Entity Set Kategorisierung
**Aufwand:** Gering | **Nutzen:** Mittel

Neue Filteroption `entitySetCategory`:
- **"All"** - Alle Entity Sets
- **"Main Entities"** - Nur Haupt-Entity Sets (ohne *Text, *Partner, etc.)
- **"Text/Description"** - Nur Beschreibungs-Entities
- **"Navigation Targets"** - Nur via Navigation erreichbare Entities

---

### Phase 3: Navigations-Eigenschaften

#### 3.1 Navigation Properties in Entity Set Liste
**Aufwand:** Hoch | **Nutzen:** Hoch

Aktuell: Nur `$expand` als Freitextfeld
Neu: Dropdown mit verfügbaren Navigationen

**Änderungen:**
- Neues Property `navigationMode` (list/custom)
- Neue Load Option `getNavigationProperties()`
- Parsing der Navigation Properties aus `$metadata`

#### 3.2 Hierarchische Entity-Auswahl
**Aufwand:** Hoch | **Nutzen:** Hoch

Ermöglicht: `SalesOrder → ToItems → ToScheduleLines`

**Änderungen:**
- Mehrstufige Dropdown-Kaskade
- Dynamisches Laden der Sub-Navigation
- URL-Builder für verschachtelte Pfade

---

### Phase 4: Function Import Verbesserungen

#### 4.1 Function Parameter Discovery
**Aufwand:** Mittel | **Nutzen:** Hoch

Aktuell: Manuelle JSON-Eingabe für Parameter
Neu: Dynamische Parameter-Felder basierend auf Metadata

**Änderungen:**
- `getFunctionImports()` erweitern: Parameter-Typ-Info zurückgeben
- Dynamische UI-Generierung für Function-Parameter
- Typ-Validierung vor Ausführung

#### 4.2 Function Kategorisierung
**Aufwand:** Gering | **Nutzen:** Mittel

- **"Read Functions"** (GET)
- **"Action Functions"** (POST)
- **"All Functions"**

---

### Phase 5: Performance & UX

#### 5.1 Lazy Loading für große Listen
**Aufwand:** Mittel | **Nutzen:** Mittel

Problem: SAP-Systeme können 1000+ Services haben
Lösung: Virtualisiertes Laden mit Paginierung

#### 5.2 Offline-Fallback erweitern
**Aufwand:** Gering | **Nutzen:** Mittel

Aktuell: 9 Common Services als Fallback ([DiscoveryService.ts:160-236](nodes/Sap/DiscoveryService.ts#L160-L236))
Neu:
- Mehr Standard-APIs (Top 50)
- User-eigene Services aus Konfiguration
- Import/Export von Service-Listen

---

## Empfohlene Reihenfolge

| Priorität | Feature | Aufwand | Nutzen |
|-----------|---------|---------|--------|
| 1 | Freitext-Suche in Services | Mittel | Hoch |
| 2 | Recently Used Services | Gering | Hoch |
| 3 | Entity Set Kategorisierung | Gering | Mittel |
| 4 | Navigation Properties Dropdown | Hoch | Hoch |
| 5 | Function Parameter Discovery | Mittel | Hoch |
| 6 | Erweiterte Fallback-Services | Gering | Mittel |

---

## Nächste Schritte

Bitte wählen Sie, welche Erweiterungen priorisiert werden sollen:

1. **Option A:** Fokus auf Service-Suche & Recently Used (Phase 1)
2. **Option B:** Fokus auf Entity-Navigation (Phase 3)
3. **Option C:** Fokus auf Function Parameter Discovery (Phase 4)
4. **Option D:** Alle Phasen schrittweise implementieren

---

## Technische Abhängigkeiten

```
SapODataProperties.ts  →  UI-Definitionen
        ↓
SapODataLoadOptions.ts →  Load Options (Dropdown-Befüllung)
        ↓
DiscoveryService.ts    →  Service-Discovery & Gruppierung
        ↓
GenericFunctions.ts    →  Metadata-Parsing
        ↓
CacheManager.ts        →  Caching von Services/Metadata
```

---

*Plan erstellt am: 2025-12-01*
