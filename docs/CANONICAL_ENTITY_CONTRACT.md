# KIISHA Canonical Entity Contract

**Version:** 1.0  
**Last Updated:** January 15, 2026  
**Status:** Active

---

## 1. Purpose

This document establishes the canonical data model for KIISHA, defining the system-of-record for each entity type and ensuring consistent terminology across the platform. All developers, integrations, and UI components must adhere to this contract.

---

## 2. Core Entities

### 2.1 Asset (Investable Unit)

| Attribute | Value |
|-----------|-------|
| **Definition** | A project/site-level investable unit representing a renewable energy installation |
| **System of Record** | `projects` table in database |
| **Primary Key** | `id` (integer, auto-increment) |
| **API Reference** | `asset_id` or `projectId` (legacy) |
| **UI Label** | "Asset" (not "Project") |
| **Examples** | "UMZA Oil Mill Solar+BESS", "Dangote Refinery Captive Solar", "Kano Mini-Grid Cluster" |

**Key Fields:**
- `name` - Human-readable asset name
- `assetClassification` - Type classification (residential, commercial, industrial, mini_grid, etc.)
- `gridConnectionType` - Grid connection status (grid_tied, islanded, islandable, weak_grid, no_grid)
- `configurationProfile` - Technology configuration (solar_only, solar_bess, solar_bess_genset, etc.)
- `couplingTopology` - Electrical coupling (AC_COUPLED, DC_COUPLED, HYBRID_COUPLED)
- `distributionTopology` - Network topology for minigrids (RADIAL, RING, MESH, STAR, TREE)
- `status` - Lifecycle stage (prospecting, development, construction, operational, decommissioned)
- `capacityMw` / `capacityMwh` - Installed capacity
- `latitude` / `longitude` - Geographic coordinates
- `country` / `state` - Location identifiers

### 2.2 Component (Equipment)

| Attribute | Value |
|-----------|-------|
| **Definition** | Physical equipment or sub-system within an Asset |
| **System of Record** | `assets` table in database (legacy naming) |
| **Primary Key** | `id` (integer, auto-increment) |
| **Foreign Key** | `systemId` → links to parent system, which links to Asset |
| **API Reference** | `componentId` or `assetId` (legacy) |
| **UI Label** | "Component" or "Equipment" |
| **Examples** | "Inverter INV-001", "Battery Bank B1", "PV Array Section A" |

**Key Fields:**
- `name` - Component identifier
- `type` - Equipment type (inverter, battery, panel, meter, transformer, etc.)
- `manufacturer` / `model` - Equipment specifications
- `serialNumber` - Unique identifier
- `status` - Operational status (active, maintenance, fault, decommissioned)
- `systemId` - Parent system reference

### 2.3 Document

| Attribute | Value |
|-----------|-------|
| **Definition** | Any uploaded file with metadata and extracted data points |
| **System of Record** | `documents` table |
| **Primary Key** | `id` (integer, auto-increment) |
| **Foreign Key** | `projectId` → links to Asset (or null for Inbox) |
| **UI Label** | "Document" |

**Ownership Rules:**
1. Every document MUST be linked to an Asset OR placed in Inbox (unassigned)
2. Documents in Inbox await human assignment to an Asset
3. AI may suggest Asset assignment with confidence score
4. Once assigned, document appears in all relevant views for that Asset

### 2.4 View (Scope)

| Attribute | Value |
|-----------|-------|
| **Definition** | A filtered subset of Assets for dashboard/reporting purposes |
| **System of Record** | `views` table (or filter state) |
| **Primary Key** | `id` (integer, auto-increment) |
| **UI Label** | "View" or "Portfolio View" |

**Scoping Rules:**
1. All charts aggregate only Assets within the active View
2. Map shows only Assets within the active View
3. CSV exports include only Assets within the active View
4. Components are never aggregated at portfolio level unless explicitly requested

---

## 3. ID Conventions

| Context | ID Field | Notes |
|---------|----------|-------|
| Asset (API) | `assetId` or `projectId` | Use `assetId` in new code |
| Asset (DB) | `projects.id` | Legacy table name retained |
| Component (API) | `componentId` | Preferred over `assetId` for equipment |
| Component (DB) | `assets.id` | Legacy table name retained |
| Document | `documentId` | Consistent across all contexts |
| View | `viewId` | Filter scope identifier |

---

## 4. UI Label Standards

| Entity | Correct Label | Incorrect Labels |
|--------|---------------|------------------|
| Investable Unit | "Asset" | "Project", "Site" (unless location-specific) |
| Equipment | "Component" | "Asset", "Device" |
| File | "Document" | "File", "Attachment" |
| Filter Scope | "View" | "Filter", "Scope" |

**Navigation Labels:**
- Sidebar: "Assets" (not "Projects")
- Dashboard: "Asset Portfolio Distribution"
- Drawer: "Asset Details" with "Components" tab
- Filters: "Filter Assets"

---

## 5. Hierarchy Diagram

```
Organization
└── Portfolio (optional grouping)
    └── Asset (projects table) ← Investable Unit
        ├── Site (physical location)
        │   └── System (electrical grouping)
        │       └── Component (assets table) ← Equipment
        ├── Documents (attached to Asset)
        ├── Checklists (reference documents as evidence)
        └── Dataroom (curated document sets)
```

---

## 6. Migration Notes

### Legacy Naming (Retained for Backward Compatibility)
- `projects` table stores Assets (not renamed to avoid breaking changes)
- `assets` table stores Components (not renamed to avoid breaking changes)
- API endpoints may use `projectId` but should transition to `assetId`

### UI Updates Required
- [ ] Sidebar: "All Projects" → "All Assets"
- [ ] Dashboard header: Show "Assets" count
- [ ] Filters: Label as "Filter Assets"
- [ ] Drawer title: "Asset Details"

---

## 7. Compliance Checklist

Before any feature release, verify:

1. **Asset-Level Operations**
   - [ ] Classification fields are on Asset (not Component)
   - [ ] Aggregations use Asset-level data
   - [ ] Filters apply to Assets

2. **View Scoping**
   - [ ] Charts respect active View
   - [ ] Map respects active View
   - [ ] Exports respect active View

3. **Document Ownership**
   - [ ] Every document has Asset link OR is in Inbox
   - [ ] Extracted data links to source document

4. **No Deletions**
   - [ ] Delete operations are soft (archive flag)
   - [ ] Remove-from-view does not delete data

---

## 8. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-15 | 1.0 | Initial contract established |
