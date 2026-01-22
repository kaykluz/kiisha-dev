# PRD Alignment Analysis Report

**Date**: 2026-01-19  
**Scope**: Customer Portal, Billing & IoT Integration - Phase 1  
**Status**: Gap Analysis Complete

---

## Executive Summary

This document analyzes the current KIISHA implementation against the PRD Alignment Patch requirements. The analysis identifies what is currently implemented, what gaps exist, and provides recommendations for achieving full alignment with the canonical model.

---

## 1. Architecture Principle #1: Multi-tenancy

### PRD Patch Requirement
> "Strict organization isolation is preserved for internal users. Customer portal access is enforced via a **Portal Scope Resolver** that returns allowed orgIds + siteIds/projectIds per portal user. All portal queries must filter by scope (allowed orgIds + allowed siteIds/projectIds) to prevent cross-org and cross-client leakage."

### Current Implementation Status: ⚠️ PARTIAL

| Aspect | Status | Notes |
|--------|--------|-------|
| Organization isolation for internal users | ✅ Implemented | `organizationId` filtering exists in queries |
| Portal Scope Resolver | ❌ NOT IMPLEMENTED | No centralized scope resolver function |
| Cross-org client support | ❌ NOT IMPLEMENTED | Current model ties customers to single org |
| Scope-based query filtering | ⚠️ Partial | Filters by `customerId` but not via resolver |

### Gap Analysis

The current implementation uses a **customer-centric model** where:
- `customers` table has `organizationId` (single org)
- `customerUsers` links to `customerId` (single customer)
- `customerProjects` links customers to projects

**Missing**: A centralized `resolvePortalScope()` function that returns:
```typescript
{
  clientAccountId: number;
  allowedOrgIds: number[];
  allowedProjectIds: number[];
  allowedAssetIds: number[];
  fieldPolicyId: number;
}
```

### Recommendation

1. Create `resolvePortalScope()` helper in `server/lib/portalScope.ts`
2. Refactor all portal endpoints to call this resolver
3. Add middleware that injects scope into context

---

## 2. Portal Identity Model

### PRD Patch Requirement
> "stakeholderPortals is the portal instance container (branding, domain/slug, landing config). It MUST reference a client_account_id. Portal access is not enforced via stakeholderPortals.allowedSiteIds alone; it is enforced via client_scope_grants (VIEW-first) resolved at request time."

### Canonical Tables Required

| Table | Status | Current Equivalent |
|-------|--------|-------------------|
| `client_accounts` | ❌ NOT EXISTS | `customers` (partial match) |
| `portal_users` | ❌ NOT EXISTS | `customerUsers` (partial match) |
| `client_account_memberships` | ❌ NOT EXISTS | None |
| `client_scope_grants` | ❌ NOT EXISTS | `customerProjects` (limited) |
| `portal_field_policies` | ❌ NOT EXISTS | None |
| `portal_notifications` | ❌ NOT EXISTS | None |
| `portal_uploads` | ❌ NOT EXISTS | None |

### Current Implementation Status: ⚠️ PARTIAL (Legacy Model)

**Existing tables that serve similar purposes:**
- `customers` → Similar to `client_accounts` but missing:
  - `legal_name`, `timezone`
  - Not designed for multi-org clients
- `customerUsers` → Similar to `portal_users` but missing:
  - Magic-link auth support
  - MFA fields
- `customerProjects` → Similar to `client_scope_grants` but:
  - Only supports PROJECT grant type
  - No VIEW/ASSET/SITE grant types
  - No `field_policy_id`
- `stakeholderPortals` → Exists but:
  - No `client_account_id` reference
  - Uses `allowedSiteIds` for access (not recommended)

### Recommendation

**Option A: Migration Path (Recommended)**
1. Rename/migrate existing tables to canonical names
2. Add missing columns to existing tables
3. Create new tables for missing entities
4. Maintain backward compatibility during transition

**Option B: Parallel Implementation**
1. Create canonical tables alongside existing
2. Build adapters for legacy compatibility
3. Gradually migrate features to canonical model

---

## 3. Portal is "Read-mostly," Not Read-only

### PRD Patch Requirement
> "Customer portal is read-mostly. Allowed writes are limited to:
> 1. Stripe invoice payment initiation
> 2. Invoice PDF download token generation
> 3. Portal uploads (meter photos/docs) into Artifact pipeline
> 4. Ticket/workOrder creation and customer comments (sanitized, no internal notes)"

### Current Implementation Status: ⚠️ PARTIAL

| Write Operation | Status | Notes |
|-----------------|--------|-------|
| Stripe payment initiation | ✅ Implemented | Via Stripe Checkout |
| Invoice PDF download | ⚠️ Partial | No token-based access |
| Portal uploads | ❌ NOT IMPLEMENTED | No `portal_uploads` table |
| Ticket/workOrder creation | ❌ NOT IMPLEMENTED | No portal-facing endpoint |
| Customer comments | ❌ NOT IMPLEMENTED | No sanitized comment flow |

### Recommendation

1. Add `portal_uploads` table with artifact integration
2. Create `POST /api/portal/work-orders` endpoint
3. Add `POST /api/portal/work-orders/:id/comments` with sanitization
4. Implement signed URL generation for invoice PDFs

---

## 4. Invoice PDF Storage and Provenance

### PRD Patch Requirement
> "Generate PDF server-side, store as Artifact (artifact_type=INVOICE_PDF) with VATR provenance referencing invoice id/version. Cache and regenerate only when invoice updatedAt > pdfArtifact.createdAt. Serve via signed URL with TTL."

### Current Implementation Status: ⚠️ PARTIAL

| Aspect | Status | Notes |
|--------|--------|-------|
| PDF generation | ⚠️ Partial | `pdfUrl` field exists but no generation logic |
| Artifact storage | ❌ NOT IMPLEMENTED | No `artifact_type=INVOICE_PDF` |
| VATR provenance | ❌ NOT IMPLEMENTED | No provenance linking |
| Cache invalidation | ❌ NOT IMPLEMENTED | No `updatedAt` comparison |
| Signed URL serving | ❌ NOT IMPLEMENTED | Direct URL storage only |

### Current Schema

```typescript
// invoices table has:
pdfUrl: text("pdfUrl"),
pdfGeneratedAt: timestamp("pdfGeneratedAt"),
```

### Missing

- `pdf_artifact_id` column on invoices
- Artifact creation with `artifact_type=INVOICE_PDF`
- VATR source document linking
- Signed URL generation logic

### Recommendation

1. Add `pdf_artifact_id` to `invoices` table
2. Extend `artifacts.artifactType` enum to include `INVOICE_PDF`
3. Create PDF generation service that:
   - Generates HTML → PDF
   - Stores in S3 via artifact pipeline
   - Links VATR provenance
   - Caches based on `updatedAt`
4. Implement signed URL endpoint with TTL

---

## 5. Invoice Ownership and Filtering

### PRD Patch Requirement
> "Invoices must be owned by client_account_id (and org_id + project_id). Portal views filter invoices by resolved scope. stakeholderPortalId may be used for portal instance config but is NOT the security boundary."

### Current Implementation Status: ⚠️ PARTIAL

| Aspect | Status | Notes |
|--------|--------|-------|
| `client_account_id` ownership | ❌ NOT IMPLEMENTED | Uses `customerId` instead |
| `org_id` ownership | ✅ Implemented | `organizationId` column exists |
| `project_id` ownership | ❌ NOT IMPLEMENTED | No project-level invoice scoping |
| Scope-based filtering | ⚠️ Partial | Filters by `customerId` directly |

### Current Schema

```typescript
// invoices table has:
organizationId: int("organizationId").notNull(),
customerId: int("customerId").notNull(),
// Missing: projectId, client_account_id
```

### Recommendation

1. Add `projectId` column to `invoices` table (nullable for consolidated invoices)
2. When migrating to canonical model, add `client_account_id`
3. Update portal queries to use scope resolver

---

## 6. Real-time Monitoring Defaults

### PRD Patch Requirement
> "Customer portal default charts use normalized aggregates (hour/day). Real-time (5s) streaming is optional and must be gated by allowedMetrics and performance controls."

### Current Implementation Status: ❌ NOT IMPLEMENTED

| Aspect | Status | Notes |
|--------|--------|-------|
| Production charts | ❌ NOT IMPLEMENTED | No portal dashboard charts |
| Normalized aggregates | ❌ NOT IMPLEMENTED | No portal data endpoints |
| Real-time streaming | ❌ NOT IMPLEMENTED | No WebSocket for portal |
| `allowedMetrics` gating | ❌ NOT IMPLEMENTED | No metric filtering |

### Recommendation

1. Create `GET /api/portal/dashboard/production` endpoint
2. Query `normalizedMeasurements` or `telemetry_aggregates`
3. Implement `allowedMetrics` filtering from scope grants
4. Add optional WebSocket subscription with rate limiting

---

## 7. Summary: Implementation Gaps

### Critical Gaps (Must Fix)

| Gap | Priority | Effort |
|-----|----------|--------|
| Portal Scope Resolver | 🔴 Critical | Medium |
| `client_scope_grants` table | 🔴 Critical | Medium |
| `portal_field_policies` table | 🔴 Critical | Medium |
| Cross-org client support | 🔴 Critical | High |

### Important Gaps (Should Fix)

| Gap | Priority | Effort |
|-----|----------|--------|
| Invoice PDF as Artifact | 🟡 High | Medium |
| VATR provenance for invoices | 🟡 High | Medium |
| `portal_uploads` table | 🟡 High | Medium |
| Work order creation from portal | 🟡 High | Medium |

### Nice-to-Have Gaps

| Gap | Priority | Effort |
|-----|----------|--------|
| Production charts | 🟢 Medium | High |
| Real-time WebSocket | 🟢 Medium | High |
| Magic-link auth | 🟢 Medium | Low |

---

## 8. Recommended Implementation Order

### Phase 1: Security Foundation (Week 1-2)
1. Create `resolvePortalScope()` helper
2. Add `client_scope_grants` table
3. Add `portal_field_policies` table
4. Refactor portal endpoints to use scope resolver

### Phase 2: Data Model Migration (Week 2-3)
1. Add missing columns to existing tables
2. Create migration scripts for canonical naming
3. Update all queries to use new model
4. Add `projectId` to invoices

### Phase 3: Invoice Enhancements (Week 3-4)
1. Implement PDF generation service
2. Store PDFs as Artifacts with VATR
3. Add signed URL endpoint
4. Implement cache invalidation

### Phase 4: Portal Writes (Week 4-5)
1. Create `portal_uploads` table
2. Implement upload → Artifact pipeline
3. Add work order creation endpoint
4. Add customer comment flow

### Phase 5: Monitoring (Week 5-6)
1. Create production chart endpoints
2. Implement `allowedMetrics` filtering
3. Add optional WebSocket streaming

---

## 9. Migration Strategy

### Backward Compatibility

The current `customers`, `customerUsers`, `customerProjects` tables can continue to function during migration. The recommended approach:

1. **Create canonical tables** alongside existing ones
2. **Add adapter layer** that maps between models
3. **Gradually migrate** features to canonical model
4. **Deprecate** legacy tables after full migration

### Data Migration Script Outline

```sql
-- Step 1: Create client_accounts from customers
INSERT INTO client_accounts (id, name, legal_name, billing_email, status, ...)
SELECT id, name, companyName, billingEmail, status, ...
FROM customers;

-- Step 2: Create portal_users from customerUsers
INSERT INTO portal_users (id, email, name, ...)
SELECT id, email, name, ...
FROM customerUsers;

-- Step 3: Create client_account_memberships
INSERT INTO client_account_memberships (client_account_id, portal_user_id, role)
SELECT customerId, id, role
FROM customerUsers;

-- Step 4: Create client_scope_grants from customerProjects
INSERT INTO client_scope_grants (client_account_id, grant_type, org_id, target_id)
SELECT cp.customerId, 'PROJECT', c.organizationId, cp.projectId
FROM customerProjects cp
JOIN customers c ON c.id = cp.customerId;
```

---

## 10. Conclusion

The current implementation provides a functional customer portal with basic authentication, invoice viewing, and Stripe payment integration. However, it uses a **legacy model** that differs from the canonical PRD specification in several key areas:

1. **No centralized scope resolver** - Security is enforced per-endpoint
2. **Single-org customers** - Cannot support multi-org client scenarios
3. **No VIEW-based grants** - Only project-level access
4. **No field policies** - All fields exposed to portal users
5. **No VATR integration** - Invoice PDFs not stored as artifacts

The recommended path forward is a **phased migration** that maintains backward compatibility while introducing the canonical model. This approach minimizes risk while achieving full PRD alignment.

---

*Document generated by KIISHA System Analysis*
