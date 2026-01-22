/**
 * Portal Work Order Service
 * 
 * Handles work order creation and comments from the customer portal.
 * Implements sanitization to prevent internal notes from being visible.
 */

import { getDb } from "../db";
import { 
  portalWorkOrders, 
  portalWorkOrderComments,
  vatrRecords,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Work order priority levels
 */
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Work order categories
 */
export type WorkOrderCategory = 
  | 'maintenance'
  | 'repair'
  | 'inspection'
  | 'installation'
  | 'support'
  | 'other';

/**
 * Create work order input
 */
interface CreateWorkOrderInput {
  portalUserId: number;
  clientAccountId: number;
  organizationId: number;
  projectId?: number;
  siteId?: number;
  assetId?: number;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  preferredDate?: Date;
  contactPhone?: string;
  contactEmail?: string;
}

/**
 * Sanitize user input to prevent XSS and SQL injection
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/'/g, "''") // Escape single quotes for SQL
    .trim()
    .substring(0, 5000); // Limit length
}

/**
 * Create a new work order from the portal
 */
export async function createPortalWorkOrder(
  input: CreateWorkOrderInput
): Promise<{ workOrderId: number; referenceNumber: string } | null> {
  const db = await getDb();
  
  // Generate reference number
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const referenceNumber = `WO-${timestamp}-${random}`;
  
  // Sanitize inputs
  const sanitizedTitle = sanitizeInput(input.title);
  const sanitizedDescription = sanitizeInput(input.description);
  
  // Create work order
  await db.execute(`
    INSERT INTO portalWorkOrders (
      referenceNumber, portalUserId, clientAccountId, organizationId,
      projectId, siteId, assetId,
      title, description, category, priority, status,
      preferredDate, contactPhone, contactEmail,
      createdAt, updatedAt
    ) VALUES (
      '${referenceNumber}',
      ${input.portalUserId},
      ${input.clientAccountId},
      ${input.organizationId},
      ${input.projectId || 'NULL'},
      ${input.siteId || 'NULL'},
      ${input.assetId || 'NULL'},
      '${sanitizedTitle}',
      '${sanitizedDescription}',
      '${input.category}',
      '${input.priority}',
      'submitted',
      ${input.preferredDate ? `'${input.preferredDate.toISOString().split('T')[0]}'` : 'NULL'},
      ${input.contactPhone ? `'${sanitizeInput(input.contactPhone)}'` : 'NULL'},
      ${input.contactEmail ? `'${sanitizeInput(input.contactEmail)}'` : 'NULL'},
      NOW(),
      NOW()
    )
  `);
  
  // Get the inserted work order ID
  const [insertedWorkOrder] = await db
    .select()
    .from(portalWorkOrders)
    .where(eq(portalWorkOrders.referenceNumber, referenceNumber))
    .limit(1);
  
  if (!insertedWorkOrder) return null;
  
  // Create VATR record
  await db.execute(`
    INSERT INTO vatrRecords (
      organizationId, entityType, entityId, action, actorType, actorId,
      timestamp, metadata, createdAt
    ) VALUES (
      ${input.organizationId}, 'portal_work_order', ${insertedWorkOrder.id}, 'created', 
      'portal_user', ${input.portalUserId},
      NOW(), 
      '{"referenceNumber": "${referenceNumber}", "category": "${input.category}", "priority": "${input.priority}"}',
      NOW()
    )
  `);
  
  return {
    workOrderId: insertedWorkOrder.id,
    referenceNumber,
  };
}

/**
 * Add a comment to a work order (portal user)
 */
export async function addPortalWorkOrderComment(
  workOrderId: number,
  portalUserId: number,
  content: string,
  attachmentIds?: number[]
): Promise<{ commentId: number } | null> {
  const db = await getDb();
  
  // Verify work order exists and belongs to portal user
  const [workOrder] = await db
    .select()
    .from(portalWorkOrders)
    .where(
      and(
        eq(portalWorkOrders.id, workOrderId),
        eq(portalWorkOrders.portalUserId, portalUserId)
      )
    )
    .limit(1);
  
  if (!workOrder) return null;
  
  // Sanitize content
  const sanitizedContent = sanitizeInput(content);
  
  // Create comment
  await db.execute(`
    INSERT INTO portalWorkOrderComments (
      workOrderId, authorType, authorId, content, isInternal,
      attachmentIds, createdAt, updatedAt
    ) VALUES (
      ${workOrderId},
      'portal_user',
      ${portalUserId},
      '${sanitizedContent}',
      false,
      ${attachmentIds && attachmentIds.length > 0 ? `'${JSON.stringify(attachmentIds)}'` : 'NULL'},
      NOW(),
      NOW()
    )
  `);
  
  // Get the inserted comment ID
  const [insertedComment] = await db
    .select()
    .from(portalWorkOrderComments)
    .where(eq(portalWorkOrderComments.workOrderId, workOrderId))
    .orderBy(desc(portalWorkOrderComments.createdAt))
    .limit(1);
  
  if (!insertedComment) return null;
  
  // Update work order timestamp
  await db.execute(`
    UPDATE portalWorkOrders SET updatedAt = NOW() WHERE id = ${workOrderId}
  `);
  
  return {
    commentId: insertedComment.id,
  };
}

/**
 * Get work orders for a portal user
 */
export async function getPortalUserWorkOrders(
  portalUserId: number,
  clientAccountId: number,
  options?: {
    status?: string;
    category?: WorkOrderCategory;
    limit?: number;
    offset?: number;
  }
): Promise<typeof portalWorkOrders.$inferSelect[]> {
  const db = await getDb();
  
  let query = `
    SELECT * FROM portalWorkOrders 
    WHERE portalUserId = ${portalUserId} 
    AND clientAccountId = ${clientAccountId}
  `;
  
  if (options?.status) {
    query += ` AND status = '${options.status}'`;
  }
  
  if (options?.category) {
    query += ` AND category = '${options.category}'`;
  }
  
  query += ` ORDER BY createdAt DESC`;
  
  if (options?.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  
  if (options?.offset) {
    query += ` OFFSET ${options.offset}`;
  }
  
  const [rows] = await db.execute(query);
  return rows as typeof portalWorkOrders.$inferSelect[];
}

/**
 * Get work order details with comments (filtered for portal visibility)
 */
export async function getPortalWorkOrderDetails(
  workOrderId: number,
  portalUserId: number
): Promise<{
  workOrder: typeof portalWorkOrders.$inferSelect;
  comments: typeof portalWorkOrderComments.$inferSelect[];
} | null> {
  const db = await getDb();
  
  // Get work order
  const [workOrder] = await db
    .select()
    .from(portalWorkOrders)
    .where(
      and(
        eq(portalWorkOrders.id, workOrderId),
        eq(portalWorkOrders.portalUserId, portalUserId)
      )
    )
    .limit(1);
  
  if (!workOrder) return null;
  
  // Get comments (excluding internal notes)
  const [commentRows] = await db.execute(`
    SELECT * FROM portalWorkOrderComments 
    WHERE workOrderId = ${workOrderId} 
    AND isInternal = false
    ORDER BY createdAt ASC
  `);
  
  return {
    workOrder,
    comments: commentRows as typeof portalWorkOrderComments.$inferSelect[],
  };
}

/**
 * Add internal note to work order (admin only)
 */
export async function addInternalWorkOrderNote(
  workOrderId: number,
  adminUserId: number,
  content: string
): Promise<{ commentId: number } | null> {
  const db = await getDb();
  
  // Verify work order exists
  const [workOrder] = await db
    .select()
    .from(portalWorkOrders)
    .where(eq(portalWorkOrders.id, workOrderId))
    .limit(1);
  
  if (!workOrder) return null;
  
  // Sanitize content
  const sanitizedContent = sanitizeInput(content);
  
  // Create internal comment
  await db.execute(`
    INSERT INTO portalWorkOrderComments (
      workOrderId, authorType, authorId, content, isInternal,
      createdAt, updatedAt
    ) VALUES (
      ${workOrderId},
      'admin',
      ${adminUserId},
      '${sanitizedContent}',
      true,
      NOW(),
      NOW()
    )
  `);
  
  // Get the inserted comment ID
  const [insertedComment] = await db
    .select()
    .from(portalWorkOrderComments)
    .where(
      and(
        eq(portalWorkOrderComments.workOrderId, workOrderId),
        eq(portalWorkOrderComments.isInternal, true)
      )
    )
    .orderBy(desc(portalWorkOrderComments.createdAt))
    .limit(1);
  
  if (!insertedComment) return null;
  
  return {
    commentId: insertedComment.id,
  };
}

/**
 * Update work order status (admin only)
 */
export async function updateWorkOrderStatus(
  workOrderId: number,
  status: 'submitted' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled',
  assignedTo?: number,
  scheduledDate?: Date,
  completionNotes?: string
): Promise<boolean> {
  const db = await getDb();
  
  let updateFields = `status = '${status}', updatedAt = NOW()`;
  
  if (assignedTo !== undefined) {
    updateFields += `, assignedTo = ${assignedTo}`;
  }
  
  if (scheduledDate) {
    updateFields += `, scheduledDate = '${scheduledDate.toISOString().split('T')[0]}'`;
  }
  
  if (completionNotes) {
    updateFields += `, completionNotes = '${sanitizeInput(completionNotes)}'`;
  }
  
  if (status === 'completed') {
    updateFields += `, completedAt = NOW()`;
  }
  
  await db.execute(`
    UPDATE portalWorkOrders SET ${updateFields} WHERE id = ${workOrderId}
  `);
  
  return true;
}
