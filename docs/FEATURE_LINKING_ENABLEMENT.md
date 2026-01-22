# FEATURE_LINKING Enablement Checklist

**Date:** 2026-01-15  
**Status:** Ready for Enablement  
**All P0 Tests:** PASSING (303/303)

---

## Pre-Enablement Verification

### Database Safety ✅
- [x] Composite unique index on `rfiDocuments` (rfiId, documentId)
- [x] Composite unique index on `rfiChecklistLinks` (rfiId, checklistItemId)
- [x] Composite unique index on `rfiScheduleLinks` (rfiId, scheduleItemId)
- [x] Composite unique index on `checklistItemDocuments` (checklistItemId, documentId)
- [x] `createdAt` column added to all link tables
- [x] `createdBy` column added to all link tables
- [x] Duplicate links handled idempotently (no errors, returns success)

### RBAC Implementation ✅
| Endpoint | Entity Check | Same Project | Edit Permission | Admin Bypass |
|----------|--------------|--------------|-----------------|--------------|
| `rfis.linkDocument` | ✅ | ✅ | ✅ | ✅ |
| `rfis.unlinkDocument` | ✅ | N/A | ✅ | ✅ |
| `rfis.linkChecklist` | ✅ | ✅ | ✅ | ✅ |
| `rfis.unlinkChecklist` | ✅ | N/A | ✅ | ✅ |
| `rfis.linkSchedule` | ✅ | ✅ | ✅ | ✅ |
| `rfis.unlinkSchedule` | ✅ | N/A | ✅ | ✅ |
| `checklists.linkDocument` | ✅ | ✅ | ✅ | ✅ |
| `checklists.unlinkDocument` | ✅ | N/A | ✅ | ✅ |

### Permission Matrix
| Role | Can Link | Can Unlink | Can View Links |
|------|----------|------------|----------------|
| Admin | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ |
| Reviewer | ❌ | ❌ | ✅ |
| Investor Viewer | ❌ | ❌ | ✅ |

### Audit Trail ✅
- [x] `link_created` activity logged with userId, timestamp, details
- [x] `link_removed` activity logged with userId, timestamp, details
- [x] Activity entries include projectId for filtering
- [x] No activity logged on failed operations

### Automated Tests ✅
| Test Case | Description | Status |
|-----------|-------------|--------|
| TC-06 | Cross-project link returns BAD_REQUEST | ✅ PASS |
| TC-07 | Cross-org link returns FORBIDDEN | ✅ PASS |
| TC-08 | Investor viewer mutation returns FORBIDDEN | ✅ PASS |
| TC-09 | Non-existent entity returns NOT_FOUND | ✅ PASS |
| TC-10 | Duplicate link returns success (idempotent) | ✅ PASS |
| Audit-01 | Activity log created on successful link | ✅ PASS |
| Audit-02 | No activity log on failed link | ✅ PASS |

---

## Enablement Steps

### Step 1: Enable Feature Flag
Navigate to **Settings → Secrets** in the Management UI and add:
```
FEATURE_LINKING=true
```

### Step 2: Restart Server
The feature flag will be picked up on next server restart. Click **Restart** in the Dashboard panel or wait for automatic deployment.

### Step 3: Verify in UI
1. Log in as an Admin or Editor user
2. Navigate to **Workspace** → Select a project
3. Open an RFI detail view
4. Verify "Link Document", "Link Checklist Item", and "Link Schedule Item" buttons are visible and functional

### Step 4: Test RBAC
1. Log in as an Investor Viewer
2. Navigate to the same RFI
3. Verify linking buttons are hidden or disabled

---

## Post-Enablement Monitoring

### Metrics to Watch
- Activity log entries for `link_created` and `link_removed` actions
- Error rates on linking endpoints (should be near zero)
- User feedback on linking workflow

### Rollback Procedure
If issues are discovered:
1. Set `FEATURE_LINKING=false` in Secrets
2. Restart server
3. Existing links remain in database but UI buttons are hidden

---

## P1 Improvements (Post-Pilot)

These items are NOT required for pilot but recommended for future:
- [ ] Add FK constraints with ON DELETE CASCADE
- [ ] Implement bidirectional view (Document → linked RFIs)
- [ ] Add bulk link/unlink operations
- [ ] Add link count badges on entity cards
- [ ] Implement link suggestions based on AI analysis

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | Manus | 2026-01-15 | ✅ |
| QA | | | |
| Product | | | |
