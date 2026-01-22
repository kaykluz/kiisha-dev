import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock the database functions
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getCommentsByResource: vi.fn(),
    getCommentCount: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    softDeleteComment: vi.fn(),
    getCommentById: vi.fn(),
    createCommentMention: vi.fn(),
    getAllUsers: vi.fn(),
    resolveCommentThread: vi.fn(),
    unresolveCommentThread: vi.fn(),
    getUnresolvedCommentCount: vi.fn(),
    getCommentsByResourceWithResolved: vi.fn(),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("comments router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("comments.list", () => {
    it("returns comments for a document resource", async () => {
      const mockComments = [
        {
          id: 1,
          resourceType: "document",
          resourceId: 1,
          userId: 1,
          content: "Test comment",
          parentId: null,
          isInternal: false,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getCommentsByResource).mockResolvedValue(mockComments);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.list({
        resourceType: "document",
        resourceId: 1,
      });

      expect(result).toEqual(mockComments);
      expect(db.getCommentsByResource).toHaveBeenCalledWith("document", 1, true);
    });

    it("returns comments for a workspace_item resource", async () => {
      const mockComments = [
        {
          id: 2,
          resourceType: "workspace_item",
          resourceId: 5,
          userId: 2,
          content: "Workspace comment",
          parentId: null,
          isInternal: true,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getCommentsByResource).mockResolvedValue(mockComments);

      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.list({
        resourceType: "workspace_item",
        resourceId: 5,
      });

      expect(result).toEqual(mockComments);
      expect(db.getCommentsByResource).toHaveBeenCalledWith("workspace_item", 5, true);
    });
  });

  describe("comments.count", () => {
    it("returns comment count for a resource", async () => {
      vi.mocked(db.getCommentCount).mockResolvedValue(5);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.count({
        resourceType: "document",
        resourceId: 1,
      });

      expect(result).toBe(5);
      expect(db.getCommentCount).toHaveBeenCalledWith("document", 1, true);
    });

    it("returns zero when no comments exist", async () => {
      vi.mocked(db.getCommentCount).mockResolvedValue(0);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.count({
        resourceType: "checklist_item",
        resourceId: 99,
      });

      expect(result).toBe(0);
    });
  });

  describe("comments.create", () => {
    it("creates a new comment successfully", async () => {
      vi.mocked(db.createComment).mockResolvedValue(undefined);
      vi.mocked(db.getCommentsByResource).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.create({
        resourceType: "document",
        resourceId: 1,
        content: "This is a new comment",
      });

      expect(result).toEqual({ success: true });
      expect(db.createComment).toHaveBeenCalledWith({
        resourceType: "document",
        resourceId: 1,
        userId: 1,
        content: "This is a new comment",
        parentId: undefined,
        isInternal: false,
      });
    });

    it("creates an internal comment", async () => {
      vi.mocked(db.createComment).mockResolvedValue(undefined);
      vi.mocked(db.getCommentsByResource).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.create({
        resourceType: "workspace_item",
        resourceId: 3,
        content: "Internal note",
        isInternal: true,
      });

      expect(result).toEqual({ success: true });
      expect(db.createComment).toHaveBeenCalledWith({
        resourceType: "workspace_item",
        resourceId: 3,
        userId: 1,
        content: "Internal note",
        parentId: undefined,
        isInternal: true,
      });
    });

    it("creates a reply to an existing comment", async () => {
      vi.mocked(db.createComment).mockResolvedValue(undefined);
      vi.mocked(db.getCommentsByResource).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.create({
        resourceType: "document",
        resourceId: 1,
        content: "This is a reply",
        parentId: 5,
      });

      expect(result).toEqual({ success: true });
      expect(db.createComment).toHaveBeenCalledWith({
        resourceType: "document",
        resourceId: 1,
        userId: 1,
        content: "This is a reply",
        parentId: 5,
        isInternal: false,
      });
    });

    it("creates a comment with mentions", async () => {
      const mockComment = {
        id: 10,
        resourceType: "document",
        resourceId: 1,
        userId: 1,
        content: "@John please review",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.createComment).mockResolvedValue(undefined);
      vi.mocked(db.getCommentsByResource).mockResolvedValue([mockComment]);
      vi.mocked(db.createCommentMention).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.create({
        resourceType: "document",
        resourceId: 1,
        content: "@John please review",
        mentions: [2, 3],
      });

      expect(result).toEqual({ success: true });
      expect(db.createCommentMention).toHaveBeenCalledTimes(2);
    });
  });

  describe("comments.update", () => {
    it("updates a comment successfully", async () => {
      const existingComment = {
        id: 1,
        resourceType: "document",
        resourceId: 1,
        userId: 1,
        content: "Original content",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCommentById).mockResolvedValue(existingComment);
      vi.mocked(db.updateComment).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.update({
        id: 1,
        content: "Updated content",
      });

      expect(result).toEqual({ success: true });
      expect(db.updateComment).toHaveBeenCalledWith(1, "Updated content");
    });

    it("throws error when updating another user's comment", async () => {
      const existingComment = {
        id: 1,
        resourceType: "document",
        resourceId: 1,
        userId: 99, // Different user
        content: "Original content",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCommentById).mockResolvedValue(existingComment);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.comments.update({
          id: 1,
          content: "Trying to update",
        })
      ).rejects.toThrow();
    });

    it("allows admin to update any comment", async () => {
      const existingComment = {
        id: 1,
        resourceType: "document",
        resourceId: 1,
        userId: 99, // Different user
        content: "Original content",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCommentById).mockResolvedValue(existingComment);
      vi.mocked(db.updateComment).mockResolvedValue(undefined);

      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.update({
        id: 1,
        content: "Admin update",
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("comments.delete", () => {
    it("deletes a comment successfully", async () => {
      const existingComment = {
        id: 1,
        resourceType: "document",
        resourceId: 1,
        userId: 1,
        content: "To be deleted",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCommentById).mockResolvedValue(existingComment);
      vi.mocked(db.softDeleteComment).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.delete({ id: 1 });

      expect(result).toEqual({ success: true });
      expect(db.softDeleteComment).toHaveBeenCalledWith(1, 1); // commentId, userId
    });

    it("throws error when deleting another user's comment", async () => {
      const existingComment = {
        id: 1,
        resourceType: "document",
        resourceId: 1,
        userId: 99, // Different user
        content: "Not yours",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCommentById).mockResolvedValue(existingComment);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.comments.delete({ id: 1 })).rejects.toThrow();
    });

    it("allows admin to delete any comment", async () => {
      const existingComment = {
        id: 1,
        resourceType: "document",
        resourceId: 1,
        userId: 99, // Different user
        content: "Admin can delete",
        parentId: null,
        isInternal: false,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCommentById).mockResolvedValue(existingComment);
      vi.mocked(db.deleteComment).mockResolvedValue(undefined);

      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.comments.delete({ id: 1 });

      expect(result).toEqual({ success: true });
    });
  });

  // Note: User mentions are handled through the users.list endpoint
});

describe("comments resource types", () => {
  it("supports document resource type", async () => {
    vi.mocked(db.getCommentCount).mockResolvedValue(3);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.count({
      resourceType: "document",
      resourceId: 1,
    });

    expect(result).toBe(3);
  });

  it("supports workspace_item resource type", async () => {
    vi.mocked(db.getCommentCount).mockResolvedValue(7);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.count({
      resourceType: "workspace_item",
      resourceId: 2,
    });

    expect(result).toBe(7);
  });

  it("supports checklist_item resource type", async () => {
    vi.mocked(db.getCommentCount).mockResolvedValue(2);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.count({
      resourceType: "checklist_item",
      resourceId: 3,
    });

    expect(result).toBe(2);
  });

  it("supports project resource type", async () => {
    vi.mocked(db.getCommentCount).mockResolvedValue(15);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.count({
      resourceType: "project",
      resourceId: 4,
    });

    expect(result).toBe(15);
  });
});

describe("comments internal visibility", () => {
  it("includes internal comments for regular users", async () => {
    vi.mocked(db.getCommentsByResource).mockResolvedValue([]);

    const ctx = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await caller.comments.list({
      resourceType: "document",
      resourceId: 1,
    });

    expect(db.getCommentsByResource).toHaveBeenCalledWith("document", 1, true);
  });

  it("includes internal comments for admin users", async () => {
    vi.mocked(db.getCommentsByResource).mockResolvedValue([]);

    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    await caller.comments.list({
      resourceType: "document",
      resourceId: 1,
    });

    expect(db.getCommentsByResource).toHaveBeenCalledWith("document", 1, true);
  });
});

describe("comments resolve/unresolve", () => {
  it("resolves a top-level comment thread", async () => {
    const topLevelComment = {
      id: 1,
      resourceType: "document",
      resourceId: 1,
      userId: 1,
      content: "Top level comment",
      parentId: null,
      isInternal: false,
      isEdited: false,
      isResolved: false,
      resolvedAt: null,
      resolvedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getCommentById).mockResolvedValue(topLevelComment);
    vi.mocked(db.resolveCommentThread).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.resolve({ id: 1 });

    expect(result).toEqual({ success: true });
    expect(db.resolveCommentThread).toHaveBeenCalledWith(1, 1);
  });

  it("throws error when trying to resolve a reply comment", async () => {
    const replyComment = {
      id: 2,
      resourceType: "document",
      resourceId: 1,
      userId: 1,
      content: "Reply comment",
      parentId: 1, // Has a parent, so it's a reply
      isInternal: false,
      isEdited: false,
      isResolved: false,
      resolvedAt: null,
      resolvedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getCommentById).mockResolvedValue(replyComment);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.comments.resolve({ id: 2 })).rejects.toThrow(
      "Only top-level comments can be resolved"
    );
  });

  it("unresolves a resolved comment thread", async () => {
    const resolvedComment = {
      id: 1,
      resourceType: "document",
      resourceId: 1,
      userId: 1,
      content: "Resolved comment",
      parentId: null,
      isInternal: false,
      isEdited: false,
      isResolved: true,
      resolvedAt: new Date(),
      resolvedById: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getCommentById).mockResolvedValue(resolvedComment);
    vi.mocked(db.unresolveCommentThread).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.unresolve({ id: 1 });

    expect(result).toEqual({ success: true });
    expect(db.unresolveCommentThread).toHaveBeenCalledWith(1);
  });

  it("throws error when trying to unresolve a reply comment", async () => {
    const replyComment = {
      id: 2,
      resourceType: "document",
      resourceId: 1,
      userId: 1,
      content: "Reply comment",
      parentId: 1,
      isInternal: false,
      isEdited: false,
      isResolved: false,
      resolvedAt: null,
      resolvedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getCommentById).mockResolvedValue(replyComment);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.comments.unresolve({ id: 2 })).rejects.toThrow(
      "Only top-level comments can be reopened"
    );
  });

  it("throws error when comment not found for resolve", async () => {
    vi.mocked(db.getCommentById).mockResolvedValue(null);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.comments.resolve({ id: 999 })).rejects.toThrow(
      "Comment not found"
    );
  });

  it("throws error when comment not found for unresolve", async () => {
    vi.mocked(db.getCommentById).mockResolvedValue(null);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.comments.unresolve({ id: 999 })).rejects.toThrow(
      "Comment not found"
    );
  });
});

describe("comments unresolved count", () => {
  it("returns count of unresolved threads", async () => {
    vi.mocked(db.getUnresolvedCommentCount).mockResolvedValue(3);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.unresolvedCount({
      resourceType: "document",
      resourceId: 1,
    });

    expect(result).toBe(3);
    expect(db.getUnresolvedCommentCount).toHaveBeenCalledWith("document", 1, true);
  });

  it("returns zero when all threads are resolved", async () => {
    vi.mocked(db.getUnresolvedCommentCount).mockResolvedValue(0);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comments.unresolvedCount({
      resourceType: "workspace_item",
      resourceId: 5,
    });

    expect(result).toBe(0);
  });
});
