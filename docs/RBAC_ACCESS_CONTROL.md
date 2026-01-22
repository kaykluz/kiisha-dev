# KIISHA Role-Based Access Control (RBAC) Matrix

**Generated:** January 15, 2026  
**Purpose:** Document RBAC implementation and access control verification

---

## 1. Role Hierarchy

### 1.1 System Roles

| Role | Description | Scope |
|------|-------------|-------|
| `admin` | Full system access, can manage all projects | Global |
| `user` | Standard user, access based on project membership | Project-scoped |

### 1.2 Project Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | Project administrator | Full CRUD, manage members |
| `editor` | Can edit project content | Create, update, link items |
| `reviewer` | Can review and comment | Read, review, comment |
| `viewer` | Read-only access | Read only |
| `investor_viewer` | Limited investor view | Filtered read access |

---

## 2. Procedure Types

### 2.1 Base Procedures

```typescript
// server/_core/trpc.ts

// Public - no authentication required
export const publicProcedure = t.procedure;

// Protected - requires authenticated user
export const protectedProcedure = t.procedure.use(requireUser);

// Admin - requires admin role
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  })
);
```

### 2.2 Project-Scoped Procedures

```typescript
// server/routers.ts

// Read access to project
const withProjectAccess = protectedProcedure.use(async (opts) => {
  if (ctx.user.role === 'admin') return next({ ctx }); // Admin bypass
  const hasAccess = await db.canUserAccessProject(ctx.user.id, input.projectId);
  if (!hasAccess) throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx });
});

// Edit access to project
const withProjectEdit = protectedProcedure.use(async (opts) => {
  if (ctx.user.role === 'admin') return next({ ctx }); // Admin bypass
  const canEdit = await db.canUserEditProject(ctx.user.id, input.projectId);
  if (!canEdit) throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx });
});
```

---

## 3. Access Control Functions

### 3.1 Database Helper Functions

```typescript
// server/db.ts

export async function canUserAccessProject(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role !== null;
}

export async function canUserEditProject(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'admin' || role === 'editor';
}

export async function canUserReviewProject(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'admin' || role === 'editor' || role === 'reviewer';
}

export async function isInvestorViewer(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'investor_viewer';
}
```

---

## 4. RBAC Matrix by Feature

### 4.1 Project Management

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List projects | ✅ All | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Assigned |
| View project | ✅ | ✅ | ✅ | ✅ | ✅ Filtered |
| Create project | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit project | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.2 Document Management

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List documents | ✅ | ✅ | ✅ | ✅ | ✅ Filtered |
| View document | ✅ | ✅ | ✅ | ✅ | ✅ Filtered |
| Upload document | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update status | ✅ | ✅ | ❌ | ❌ | ❌ |
| Archive document | ✅ | ✅ | ❌ | ❌ | ❌ |
| Restore document | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.3 RFI / Workspace Items

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List RFIs | ✅ | ✅ | ✅ | ✅ | ❌ |
| View RFI | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create RFI | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update RFI | ✅ | ✅ | ❌ | ❌ | ❌ |
| Link items | ✅ | ✅ | ❌ | ❌ | ❌ |
| Archive RFI | ✅ | ✅ | ❌ | ❌ | ❌ |
| Restore RFI | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.4 Checklists

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List checklists | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create checklist | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update item | ✅ | ✅ | ❌ | ❌ | ❌ |
| Archive item | ✅ | ✅ | ❌ | ❌ | ❌ |
| Restore item | ✅ | ❌ | ❌ | ❌ | ❌ |
| Link documents | ✅ | ✅ | ❌ | ❌ | ❌ |

### 4.5 Comments

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| View comments | ✅ All | ✅ All | ✅ All | ✅ Public | ✅ Public |
| View internal | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create comment | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit own comment | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete any comment | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete own comment | ✅ | ✅ | ✅ | ❌ | ❌ |

### 4.6 View Scopes

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List views | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create view | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update view | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete view | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exclude items | ✅ | ❌ | ❌ | ❌ | ❌ |
| Include items | ✅ | ❌ | ❌ | ❌ | ❌ |
| Hide fields | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pin versions | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.7 Templates

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List templates | ✅ | ✅ | ✅ | ✅ | ❌ |
| View template | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create template | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update template | ✅ | ❌ | ❌ | ❌ | ❌ |
| Override assignment | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.8 VATR Assets

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List VATR assets | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create VATR asset | ✅ | ✅ | ❌ | ❌ | ❌ |
| Link source doc | ✅ | ✅ | ❌ | ❌ | ❌ |
| Verify asset | ✅ | ✅ | ✅ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ✅ | ✅ | ❌ |

### 4.9 Integrations

| Operation | Admin | Editor | Reviewer | Viewer | Investor |
|-----------|-------|--------|----------|--------|----------|
| List integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Test integration | ✅ | ✅ | ❌ | ❌ | ❌ |
| Disconnect | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Admin Bypass Pattern

All project-scoped operations include an admin bypass:

```typescript
// Pattern used throughout routers.ts
if (ctx.user.role === 'admin') {
  return next({ ctx }); // Admin bypasses project-level checks
}
```

This ensures:
- System admins can access all projects
- System admins can perform any operation
- Project-level roles only apply to non-admin users

---

## 6. Investor Filtering

Investor viewers receive filtered data:

```typescript
// Documents filtered for investors
listByProject: withProjectAccess
  .query(async ({ ctx, input }) => {
    const isInvestor = await db.isInvestorViewer(ctx.user.id, input.projectId);
    return db.getDocumentsByProject(input.projectId, isInvestor);
    // If isInvestor=true, only returns investor-visible documents
  })
```

---

## 7. Test Coverage

### 7.1 RBAC Test Files

| Test File | Coverage |
|-----------|----------|
| `kiisha.test.ts` | Admin/user role assignment |
| `linking.security.test.ts` | Project edit permissions |
| `linking.integration.test.ts` | Cross-project access control |
| `immutability.test.ts` | Archive/restore permissions |

### 7.2 Sample Test

```typescript
// server/linking.security.test.ts
describe("Security: Admin bypass", () => {
  it("admin can link documents without project role check", async () => {
    const ctx = createMockContext({ id: 100, role: 'admin' });
    
    // Admin bypasses canUserEditProject check
    const result = await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
    expect(result.success).toBe(true);
  });
});
```

---

## 8. Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| System roles defined | ✅ PASS | `admin`, `user` in schema |
| Project roles defined | ✅ PASS | `admin`, `editor`, `reviewer`, `viewer`, `investor_viewer` |
| Protected procedures enforced | ✅ PASS | 200+ endpoints use `protectedProcedure` |
| Admin procedures enforced | ✅ PASS | Template/view management uses `adminProcedure` |
| Project access checked | ✅ PASS | `withProjectAccess` middleware |
| Project edit checked | ✅ PASS | `withProjectEdit` middleware |
| Admin bypass implemented | ✅ PASS | `ctx.user.role === 'admin'` checks |
| Investor filtering implemented | ✅ PASS | `isInvestorViewer()` function |
| Archive/restore restricted | ✅ PASS | Restore requires admin role |
| View management restricted | ✅ PASS | Create/update/delete requires admin |
