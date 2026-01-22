# Data Immutability and View Overlay System

**Date:** 2026-01-15  
**Status:** Pilot Ready

---

## 1. Canonical Data Tables with Soft-Delete Columns

The following core tables have soft-delete columns to support data immutability:

### Documents Table
```sql
CREATE TABLE documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  projectId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  fileUrl TEXT,
  fileKey TEXT,
  category VARCHAR(100),
  status VARCHAR(50),
  uploadedBy INT,
  uploadedAt TIMESTAMP,
  -- Soft-delete columns
  archivedAt TIMESTAMP NULL,
  archivedBy INT NULL,
  archiveReason TEXT NULL,
  visibilityState ENUM('active', 'archived', 'superseded') DEFAULT 'active'
);
```

### RFIs Table
```sql
CREATE TABLE rfis (
  id INT PRIMARY KEY AUTO_INCREMENT,
  projectId INT NOT NULL,
  code VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50),
  priority VARCHAR(20),
  -- Soft-delete columns
  archivedAt TIMESTAMP NULL,
  archivedBy INT NULL,
  archiveReason TEXT NULL,
  visibilityState ENUM('active', 'archived', 'superseded') DEFAULT 'active'
);
```

### Closing Checklist Items Table
```sql
CREATE TABLE closingChecklistItems (
  id INT PRIMARY KEY AUTO_INCREMENT,
  checklistId INT NOT NULL,
  name VARCHAR(255),
  status VARCHAR(50),
  -- Soft-delete columns
  archivedAt TIMESTAMP NULL,
  archivedBy INT NULL,
  archiveReason TEXT NULL,
  visibilityState ENUM('active', 'archived', 'superseded') DEFAULT 'active'
);
```

### Asset Attributes Table
```sql
CREATE TABLE assetAttributes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  assetId INT NOT NULL,
  attributeKey VARCHAR(100),
  attributeValue TEXT,
  -- Soft-delete columns
  archivedAt TIMESTAMP NULL,
  archivedBy INT NULL,
  archiveReason TEXT NULL,
  visibilityState ENUM('active', 'archived', 'superseded') DEFAULT 'active'
);
```

---

## 2. View Overlay Tables

### viewScopes Table
Defines named view perspectives for filtering data without modifying underlying records.

```sql
CREATE TABLE viewScopes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organizationId INT NOT NULL,
  viewType ENUM('portfolio', 'dataroom', 'report', 'checklist', 'custom') NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  config JSON,                    -- View-specific settings
  ownerId INT NOT NULL,           -- User who created the view
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Example:**
| id | organizationId | viewType | name | ownerId |
|----|----------------|----------|------|---------|
| 1 | 100 | portfolio | "Investor Portfolio Q1" | 5 |
| 2 | 100 | dataroom | "Due Diligence Room" | 5 |

### viewItems Table
Controls item-level inclusion/exclusion per view.

```sql
CREATE TABLE viewItems (
  id INT PRIMARY KEY AUTO_INCREMENT,
  viewId INT NOT NULL,
  entityType ENUM('asset', 'project', 'document', 'field', 'evidence', 'task', 'rfi', 'checklist_item') NOT NULL,
  entityId INT NOT NULL,
  inclusionState ENUM('include', 'exclude') NOT NULL,
  reason TEXT,                    -- Why item was hidden/shown
  updatedBy INT NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE KEY view_entity_unique (viewId, entityType, entityId)
);
```

**How "Remove from View" Works:**
```sql
-- To hide RFI #42 from view #1:
INSERT INTO viewItems (viewId, entityType, entityId, inclusionState, reason, updatedBy)
VALUES (1, 'rfi', 42, 'exclude', 'Not relevant for investor presentation', 5);

-- To restore it:
UPDATE viewItems SET inclusionState = 'include', reason = 'Restored by admin'
WHERE viewId = 1 AND entityType = 'rfi' AND entityId = 42;
```

### viewFieldOverrides Table
Controls field-level visibility within a view.

```sql
CREATE TABLE viewFieldOverrides (
  id INT PRIMARY KEY AUTO_INCREMENT,
  viewId INT NOT NULL,
  assetId INT NOT NULL,
  fieldKey VARCHAR(100) NOT NULL,
  state ENUM('show', 'hide', 'pin_version') NOT NULL,
  specificVersionId INT,          -- For pinning specific version
  reason TEXT,
  updatedBy INT NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE KEY view_field_unique (viewId, assetId, fieldKey)
);
```

**How "Hide Field" Works:**
```sql
-- To hide the "purchase_price" field for asset #10 in view #1:
INSERT INTO viewFieldOverrides (viewId, assetId, fieldKey, state, reason, updatedBy)
VALUES (1, 10, 'purchase_price', 'hide', 'Confidential - not for external view', 5);
```

---

## 3. Field-Level History Ledger

### assetFieldHistory Table
Immutable audit trail for all field changes.

```sql
CREATE TABLE assetFieldHistory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  assetId INT NOT NULL,
  fieldKey VARCHAR(100) NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  changeType ENUM(
    'ai_extracted',        -- Value extracted by AI from document
    'manual_edit',         -- User manually edited value
    'verified',            -- User verified AI suggestion
    'suppressed_in_view',  -- Hidden in a specific view
    'restored_in_view',    -- Restored to a view
    'superseded'           -- Replaced by newer version
  ) NOT NULL,
  sourceDocumentId INT,           -- Document that provided this value
  sourcePage INT,                 -- Page number in source document
  confidence DECIMAL(3,2),        -- AI confidence score (0.00-1.00)
  viewId INT,                     -- View context (for view-scoped changes)
  changedBy INT NOT NULL,
  changedAt TIMESTAMP DEFAULT NOW(),
  reason TEXT
);
```

---

## 4. Export Manifests Table

### exportManifests Table
Audit trail for all exports with view scoping.

```sql
CREATE TABLE exportManifests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  viewId INT NOT NULL,            -- Which view was exported
  exportType ENUM('csv', 'excel', 'pdf', 'due_diligence_pack') NOT NULL,
  exportedBy INT NOT NULL,
  exportedAt TIMESTAMP DEFAULT NOW(),
  includeHidden BOOLEAN DEFAULT FALSE,
  filters JSON,                   -- Applied filters
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  itemCount INT,                  -- Number of items exported
  fileUrl TEXT,                   -- URL to exported file
  checksum VARCHAR(64),           -- SHA-256 hash of export
  manifestJson JSON               -- Full manifest with item IDs
);
```

---

## 5. View-Scoped Query Pattern

When querying data for a view, the system applies this logic:

```typescript
async function getDocumentsForView(viewId: number, projectId: number) {
  // 1. Get all documents for project
  const docs = await db.select().from(documents)
    .where(eq(documents.projectId, projectId));
  
  // 2. Filter out archived/superseded (unless admin override)
  const activeDocs = docs.filter(d => 
    d.visibilityState === 'active'
  );
  
  // 3. Get view exclusions
  const exclusions = await db.select().from(viewItems)
    .where(and(
      eq(viewItems.viewId, viewId),
      eq(viewItems.entityType, 'document'),
      eq(viewItems.inclusionState, 'exclude')
    ));
  
  const excludedIds = new Set(exclusions.map(e => e.entityId));
  
  // 4. Apply view filter
  return activeDocs.filter(d => !excludedIds.has(d.id));
}
```

---

## 6. API Endpoints Summary

| Endpoint | Purpose | RBAC |
|----------|---------|------|
| `views.create` | Create new view scope | Admin only |
| `views.excludeItem` | Hide item from view | Admin only |
| `views.includeItem` | Restore item to view | Admin only |
| `views.hideField` | Hide field in view | Admin only |
| `views.showField` | Show field in view | Admin only |
| `views.getDocuments` | Get view-scoped documents | All authenticated |
| `views.getFieldHistory` | Get field audit trail | All authenticated |
| `views.createExportManifest` | Create export with audit | All authenticated |

---

## 7. Visibility State Transitions

```
┌─────────┐     archive()      ┌──────────┐
│ active  │ ─────────────────► │ archived │
└─────────┘                    └──────────┘
     │                              │
     │ supersede()                  │ unarchive()
     ▼                              ▼
┌────────────┐                ┌─────────┐
│ superseded │                │ active  │
└────────────┘                └─────────┘
```

**Rules:**
- `active` → `archived`: Soft delete, can be restored
- `active` → `superseded`: Replaced by newer version, cannot be restored
- `archived` → `active`: Admin restore only
- `superseded` → never changes (immutable)


---

## 8. StatusLight Component - All 10 States

The StatusLight component provides visual indicators for data status across the application.

### State Definitions

| State | Color | Icon | Condition | Description |
|-------|-------|------|-----------|-------------|
| `verified` | Emerald/Green | CheckCircle2 | `verificationStatus === 'verified'` OR `status === 'verified'` | Data has been verified by a human reviewer |
| `ai_suggested` | Amber/Yellow | Sparkles | `aiSuggested === true` AND not verified/rejected | AI has extracted this value, awaiting human verification |
| `unverified` | Gray | HelpCircle | Default state when no other conditions match | Data has not been verified |
| `rejected` | Red | XCircle | `verificationStatus === 'rejected'` OR `status === 'rejected'` | Data has been rejected and should not be used |
| `pending` | Blue | Clock | `status === 'pending'` | Item is awaiting action or review |
| `archived` | Muted Gray (dashed border) | Archive | `visibilityState === 'archived'` | Item has been archived (soft deleted) |
| `superseded` | Gray + Strikethrough (dashed border) | ArrowRightLeft | `visibilityState === 'superseded'` | Item has been replaced by a newer version |
| `hidden_in_view` | Gray (dotted border) | EyeOff | Item exists in `viewItems` with `inclusionState === 'exclude'` | Item exists but is hidden in the current view |
| `missing` | Orange | AlertCircle | `status === 'missing'` | Required item is missing |
| `na` | Light Gray | Circle | `status === 'na'` | Not applicable for this context |

### Status Derivation Logic

```typescript
function deriveStatus(data: {
  visibilityState?: string;
  verificationStatus?: string;
  status?: string;
  aiSuggested?: boolean;
}): StatusType {
  // Priority 1: Visibility state (archived/superseded take precedence)
  if (data.visibilityState === "archived") return "archived";
  if (data.visibilityState === "superseded") return "superseded";
  
  // Priority 2: Verification status
  if (data.verificationStatus === "verified") return "verified";
  if (data.verificationStatus === "rejected") return "rejected";
  
  // Priority 3: AI suggestion flag
  if (data.aiSuggested) return "ai_suggested";
  
  // Priority 4: General status field
  if (data.status === "verified") return "verified";
  if (data.status === "pending") return "pending";
  if (data.status === "rejected") return "rejected";
  if (data.status === "missing") return "missing";
  if (data.status === "na") return "na";
  
  // Default
  return "unverified";
}
```

### Priority Order

1. **Visibility State** (highest priority)
   - `archived` → Item is soft-deleted
   - `superseded` → Item replaced by newer version

2. **Verification Status**
   - `verified` → Human-confirmed
   - `rejected` → Human-rejected

3. **AI Flag**
   - `aiSuggested: true` → Awaiting verification

4. **General Status**
   - `pending` → In progress
   - `missing` → Required but absent
   - `na` → Not applicable

5. **Default**
   - `unverified` → No status information

### Usage Examples

```tsx
// Simple status light
<StatusLight status="verified" />

// With label
<StatusLight status="ai_suggested" showLabel />

// Badge variant
<StatusBadge status="pending" />

// Derive status from data
const status = deriveStatus({
  visibilityState: 'active',
  verificationStatus: 'verified',
  aiSuggested: false
}); // Returns 'verified'
```


---

## 9. Export Manifest Format

Every export creates an `exportManifests` record that captures what was exported, from which view, and the provenance of the data.

### Schema

```sql
CREATE TABLE exportManifests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- View reference
  viewId INT,                           -- Which view was used for scoping
  viewType VARCHAR(50),                 -- 'portfolio_view', 'data_room', 'investor_report'
  
  -- Export details
  exportType ENUM('csv', 'pdf', 'due_diligence_pack', 'json') NOT NULL,
  exportedBy INT NOT NULL,              -- User who triggered export
  exportedAt TIMESTAMP DEFAULT NOW(),
  
  -- Content manifest (JSON array)
  itemsExported JSON,                   -- List of all items included
  
  -- VATR provenance references (JSON array)
  provenanceRefs JSON,                  -- Source document references for each field
  
  -- File reference
  fileUrl TEXT,                         -- S3 URL of exported file
  fileSize INT,                         -- Size in bytes
  
  -- Signoff (for external exports)
  requiresSignoff BOOLEAN DEFAULT FALSE,
  signedOffBy INT,
  signedOffAt TIMESTAMP
);
```

### JSON Field Formats

#### itemsExported
```json
[
  { "entityType": "rfi", "entityId": 123, "version": 1 },
  { "entityType": "document", "entityId": 456, "version": 2 },
  { "entityType": "asset_attribute", "entityId": 789, "version": 3 }
]
```

#### provenanceRefs
```json
[
  {
    "fieldKey": "asset.capacity_mw",
    "sourceDocId": 456,
    "sourcePage": 12,
    "confidence": 0.95
  },
  {
    "fieldKey": "asset.cod_date",
    "sourceDocId": 789,
    "sourcePage": 3,
    "confidence": 0.87
  }
]
```

### View Scoping in Exports

When an export is generated with a `viewId`:

1. **Query Phase**: The export query joins with `viewItems` to exclude items where `inclusionState = 'exclude'`
2. **Field Phase**: For asset attributes, `viewFieldOverrides` is checked to hide suppressed fields
3. **Manifest Phase**: Only included items are recorded in `itemsExported`

```typescript
// Example: Export RFIs with view scoping
const exportRfis = async (projectId: number, viewId?: number) => {
  // Get base RFIs
  let rfis = await getRfisByProject(projectId);
  
  // Apply view exclusions if viewId provided
  if (viewId) {
    const exclusions = await getViewExclusions(viewId, 'rfi');
    const excludedIds = new Set(exclusions.map(e => e.entityId));
    rfis = rfis.filter(rfi => !excludedIds.has(rfi.id));
  }
  
  // Filter out archived items
  rfis = rfis.filter(rfi => rfi.archivedAt === null);
  
  // Create manifest
  const manifest = {
    viewId,
    viewType: viewId ? 'portfolio_view' : null,
    exportType: 'csv',
    itemsExported: rfis.map(r => ({ 
      entityType: 'rfi', 
      entityId: r.id 
    })),
    // ... provenance refs
  };
  
  return { rfis, manifest };
};
```

### Verification: Exports Include Only View-Scoped Items

1. **Archived items** (`archivedAt IS NOT NULL`) are always excluded
2. **View-excluded items** (in `viewItems` with `inclusionState = 'exclude'`) are excluded when `viewId` is provided
3. **Suppressed fields** (in `viewFieldOverrides` with `state = 'hide'`) are omitted from asset attribute exports
4. **Manifest records** exactly what was exported for audit trail

### Export Integrity Checks

Before export completion:
- Verify all `itemsExported` entities exist and are accessible
- Verify user has permission to export from the view
- Record file hash for integrity verification
- Store provenance references for all AI-extracted fields
