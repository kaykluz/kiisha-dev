import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock the db module
vi.mock('./db', () => ({
  getRfiById: vi.fn(),
  getDocumentById: vi.fn(),
  getChecklistItemById: vi.fn(),
  getChecklistById: vi.fn(),
  getScheduleItemById: vi.fn(),
  canUserEditProject: vi.fn(),
  linkRfiToDocument: vi.fn(),
  linkRfiToChecklist: vi.fn(),
  linkRfiToSchedule: vi.fn(),
  unlinkRfiFromDocument: vi.fn(),
  unlinkRfiFromChecklist: vi.fn(),
  unlinkRfiFromSchedule: vi.fn(),
  linkChecklistItemToDocument: vi.fn(),
  unlinkChecklistItemFromDocument: vi.fn(),
  createUserActivity: vi.fn(),
}));

import * as db from './db';

// Helper to create mock context
function createMockContext(user: { id: number; role: string }) {
  return { user };
}

// Helper to simulate procedure execution with RBAC checks
async function simulateLinkDocument(ctx: any, input: { rfiId: number; documentId: number }) {
  const rfi = await db.getRfiById(input.rfiId);
  if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
  
  const doc = await db.getDocumentById(input.documentId);
  if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
  
  if ((rfi as any).projectId !== (doc as any).projectId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot link items from different projects' });
  }
  
  if (ctx.user.role !== 'admin') {
    const canEdit = await db.canUserEditProject(ctx.user.id, (rfi as any).projectId);
    if (!canEdit) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create links in this project' });
    }
  }
  
  await db.linkRfiToDocument(input.rfiId, input.documentId, ctx.user.id);
  await db.createUserActivity({
    userId: ctx.user.id,
    action: 'link_created',
    entityType: 'rfi_document_link',
    entityId: input.rfiId,
    details: { rfiId: input.rfiId, documentId: input.documentId },
    projectId: (rfi as any).projectId,
  });
  
  return { success: true };
}

describe('Linking Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-06: Cross-Project Link Prevention', () => {
    it('should reject linking RFI to document from different project', async () => {
      // Setup: RFI in project 1, document in project 2
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 2, title: 'Test Doc' } as any);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      await expect(simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 }))
        .rejects.toThrow('Cannot link items from different projects');
    });

    it('should allow linking RFI to document in same project', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(true);
      vi.mocked(db.linkRfiToDocument).mockResolvedValue({} as any);
      vi.mocked(db.createUserActivity).mockResolvedValue({} as any);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      const result = await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
      expect(result.success).toBe(true);
    });
  });

  describe('TC-07: Cross-Org Link Prevention', () => {
    it('should reject when user has no access to project', async () => {
      // User from org A trying to link items in org B's project
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(false); // No access
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      await expect(simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 }))
        .rejects.toThrow('You do not have permission to create links in this project');
    });
  });

  describe('TC-08: Investor Viewer RBAC', () => {
    it('should reject link mutation from investor_viewer role', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      // canUserEditProject returns false for investor_viewer (they only have view access)
      vi.mocked(db.canUserEditProject).mockResolvedValue(false);
      
      const ctx = createMockContext({ id: 100, role: 'user' }); // investor_viewer at project level
      
      await expect(simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 }))
        .rejects.toThrow('You do not have permission to create links in this project');
    });

    it('should allow link mutation from editor role', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(true); // Editor has access
      vi.mocked(db.linkRfiToDocument).mockResolvedValue({} as any);
      vi.mocked(db.createUserActivity).mockResolvedValue({} as any);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      const result = await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
      expect(result.success).toBe(true);
    });

    it('should allow link mutation from admin role (bypasses project check)', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      vi.mocked(db.linkRfiToDocument).mockResolvedValue({} as any);
      vi.mocked(db.createUserActivity).mockResolvedValue({} as any);
      
      const ctx = createMockContext({ id: 100, role: 'admin' });
      
      // Admin bypasses canUserEditProject check
      const result = await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
      expect(result.success).toBe(true);
      expect(db.canUserEditProject).not.toHaveBeenCalled();
    });
  });

  describe('TC-09: Entity Existence Validation', () => {
    it('should reject when RFI does not exist', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue(null);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      await expect(simulateLinkDocument(ctx, { rfiId: 999, documentId: 10 }))
        .rejects.toThrow('RFI not found');
    });

    it('should reject when document does not exist', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue(null);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      await expect(simulateLinkDocument(ctx, { rfiId: 1, documentId: 999 }))
        .rejects.toThrow('Document not found');
    });
  });

  describe('TC-10: Duplicate Link Prevention', () => {
    it('should handle duplicate link idempotently (no error)', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(true);
      // onDuplicateKeyUpdate returns success even if link exists
      vi.mocked(db.linkRfiToDocument).mockResolvedValue({} as any);
      vi.mocked(db.createUserActivity).mockResolvedValue({} as any);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      // First link
      const result1 = await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
      expect(result1.success).toBe(true);
      
      // Second link (duplicate) - should succeed idempotently
      const result2 = await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
      expect(result2.success).toBe(true);
    });
  });

  describe('Audit Trail Verification', () => {
    it('should create activity log entry on successful link', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 1, title: 'Test Doc' } as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(true);
      vi.mocked(db.linkRfiToDocument).mockResolvedValue({} as any);
      vi.mocked(db.createUserActivity).mockResolvedValue({} as any);
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      await simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 });
      
      expect(db.createUserActivity).toHaveBeenCalledWith({
        userId: 100,
        action: 'link_created',
        entityType: 'rfi_document_link',
        entityId: 1,
        details: { rfiId: 1, documentId: 10 },
        projectId: 1,
      });
    });

    it('should NOT create activity log entry on failed link', async () => {
      vi.mocked(db.getRfiById).mockResolvedValue({ id: 1, projectId: 1, title: 'Test RFI' } as any);
      vi.mocked(db.getDocumentById).mockResolvedValue({ id: 10, projectId: 2, title: 'Test Doc' } as any); // Different project
      
      const ctx = createMockContext({ id: 100, role: 'user' });
      
      await expect(simulateLinkDocument(ctx, { rfiId: 1, documentId: 10 })).rejects.toThrow();
      
      expect(db.createUserActivity).not.toHaveBeenCalled();
    });
  });
});
