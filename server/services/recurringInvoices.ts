/**
 * Recurring Invoice Service
 * 
 * Manages automatic invoice generation for subscription-based customers.
 * Supports monthly, quarterly, and annual billing cycles.
 * 
 * WHO MANAGES THIS:
 * - Admin/Operator: Creates and manages recurring invoice schedules
 * - System: Automatically generates invoices on schedule
 * - Customer: Views generated invoices in portal (read-only)
 */

import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { sendNewInvoiceEmail } from './portalNotifications';

// Types
export interface RecurringSchedule {
  id: number;
  customerId: number;
  organizationId?: number;
  name: string;
  description?: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  dayOfMonth: number;
  dayOfWeek: number;
  startDate: Date;
  endDate?: Date;
  nextGenerationDate: Date;
  lastGeneratedAt?: Date;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  currency: string;
  taxRate: number;
  paymentTermsDays: number;
  notes?: string;
}

export interface RecurringLineItem {
  id: number;
  scheduleId: number;
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  taxRate: number;
  sortOrder: number;
}

/**
 * Create a new recurring invoice schedule
 * Called by: Admin via Admin Dashboard → Billing → Recurring Invoices
 */
export async function createRecurringSchedule(params: {
  customerId: number;
  organizationId?: number;
  name: string;
  description?: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: Date;
  endDate?: Date;
  currency?: string;
  taxRate?: number;
  paymentTermsDays?: number;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
  createdBy?: number;
}): Promise<{ scheduleId: number; nextGenerationDate: Date }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Calculate first generation date
  const nextGenerationDate = calculateNextGenerationDate(
    params.startDate,
    params.frequency,
    params.dayOfMonth || 1,
    params.dayOfWeek || 1
  );

  // Insert schedule
  const [result] = await db.execute(sql`
    INSERT INTO recurring_invoice_schedules (
      customerId, organizationId, name, description, frequency,
      dayOfMonth, dayOfWeek, startDate, endDate, nextGenerationDate,
      status, currency, taxRate, paymentTermsDays, notes, createdBy
    ) VALUES (
      ${params.customerId},
      ${params.organizationId || null},
      ${params.name},
      ${params.description || null},
      ${params.frequency},
      ${params.dayOfMonth || 1},
      ${params.dayOfWeek || 1},
      ${params.startDate.toISOString().split('T')[0]},
      ${params.endDate ? params.endDate.toISOString().split('T')[0] : null},
      ${nextGenerationDate.toISOString().split('T')[0]},
      'active',
      ${params.currency || 'USD'},
      ${params.taxRate || 0},
      ${params.paymentTermsDays || 30},
      ${params.notes || null},
      ${params.createdBy || null}
    )
  `);

  const scheduleId = (result as any).insertId;

  // Insert line items
  for (let i = 0; i < params.lineItems.length; i++) {
    const item = params.lineItems[i];
    await db.execute(sql`
      INSERT INTO recurring_invoice_items (
        scheduleId, description, quantity, unitPrice, taxRate, sortOrder
      ) VALUES (
        ${scheduleId},
        ${item.description},
        ${item.quantity},
        ${item.unitPrice},
        ${item.taxRate || 0},
        ${i}
      )
    `);
  }

  console.log(`[RecurringInvoices] Created schedule ${scheduleId} for customer ${params.customerId}`);
  
  return { scheduleId, nextGenerationDate };
}

/**
 * Generate invoices for all due recurring schedules
 * Called by: System cron job (daily at midnight)
 */
export async function processRecurringInvoices(): Promise<{
  processed: number;
  generated: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const today = new Date().toISOString().split('T')[0];
  
  // Find all schedules due for generation
  const [schedules] = await db.execute(sql`
    SELECT * FROM recurring_invoice_schedules
    WHERE status = 'active'
    AND nextGenerationDate <= ${today}
    AND (endDate IS NULL OR endDate >= ${today})
  `);

  const scheduleList = schedules as RecurringSchedule[];
  let generated = 0;
  let errors = 0;

  for (const schedule of scheduleList) {
    try {
      await generateInvoiceFromSchedule(schedule);
      generated++;
    } catch (error) {
      console.error(`[RecurringInvoices] Error generating invoice for schedule ${schedule.id}:`, error);
      errors++;
    }
  }

  console.log(`[RecurringInvoices] Processed ${scheduleList.length} schedules, generated ${generated} invoices, ${errors} errors`);
  
  return {
    processed: scheduleList.length,
    generated,
    errors
  };
}

/**
 * Generate a single invoice from a recurring schedule
 */
async function generateInvoiceFromSchedule(schedule: RecurringSchedule): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get line items for this schedule
  const [items] = await db.execute(sql`
    SELECT * FROM recurring_invoice_items
    WHERE scheduleId = ${schedule.id}
    ORDER BY sortOrder
  `);
  const lineItems = items as RecurringLineItem[];

  // Calculate totals
  let subtotal = 0;
  let totalTax = 0;
  
  for (const item of lineItems) {
    const itemTotal = item.quantity * item.unitPrice;
    const itemTax = itemTotal * (item.taxRate / 100);
    subtotal += itemTotal;
    totalTax += itemTax;
  }

  const total = subtotal + totalTax;

  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + schedule.paymentTermsDays);

  // Generate invoice number
  const invoiceNumber = `INV-${Date.now()}-${schedule.customerId}`;

  // Create the invoice
  const [invoiceResult] = await db.execute(sql`
    INSERT INTO invoices (
      customerId, organizationId, invoiceNumber, status,
      subtotal, taxAmount, total, currency,
      dueDate, notes, createdAt
    ) VALUES (
      ${schedule.customerId},
      ${schedule.organizationId || null},
      ${invoiceNumber},
      'pending',
      ${subtotal},
      ${totalTax},
      ${total},
      ${schedule.currency},
      ${dueDate.toISOString().split('T')[0]},
      ${`Auto-generated from recurring schedule: ${schedule.name}`},
      NOW()
    )
  `);

  const invoiceId = (invoiceResult as any).insertId;

  // Create line items
  for (const item of lineItems) {
    await db.execute(sql`
      INSERT INTO invoiceLineItems (
        invoiceId, description, quantity, unitPrice, amount, taxRate
      ) VALUES (
        ${invoiceId},
        ${item.description},
        ${item.quantity},
        ${item.unitPrice},
        ${item.quantity * item.unitPrice},
        ${item.taxRate}
      )
    `);
  }

  // Record the generation
  const periodStart = schedule.lastGeneratedAt || schedule.startDate;
  const periodEnd = new Date();
  
  await db.execute(sql`
    INSERT INTO recurring_invoice_generations (
      scheduleId, invoiceId, periodStart, periodEnd
    ) VALUES (
      ${schedule.id},
      ${invoiceId},
      ${periodStart instanceof Date ? periodStart.toISOString().split('T')[0] : periodStart},
      ${periodEnd.toISOString().split('T')[0]}
    )
  `);

  // Update schedule with next generation date
  const nextDate = calculateNextGenerationDate(
    new Date(),
    schedule.frequency,
    schedule.dayOfMonth,
    schedule.dayOfWeek
  );

  // Check if schedule should be completed
  let newStatus = schedule.status;
  if (schedule.endDate && nextDate > new Date(schedule.endDate)) {
    newStatus = 'completed';
  }

  await db.execute(sql`
    UPDATE recurring_invoice_schedules
    SET nextGenerationDate = ${nextDate.toISOString().split('T')[0]},
        lastGeneratedAt = NOW(),
        status = ${newStatus}
    WHERE id = ${schedule.id}
  `);

  // Send notification email to customer
  try {
    await sendNewInvoiceEmail({
      invoiceId,
      customerId: schedule.customerId,
      invoiceNumber,
      amount: total,
      dueDate,
      isRecurring: true,
      scheduleName: schedule.name
    });
  } catch (error) {
    console.error(`[RecurringInvoices] Failed to send invoice email:`, error);
  }

  console.log(`[RecurringInvoices] Generated invoice ${invoiceId} from schedule ${schedule.id}`);
  
  return invoiceId;
}

/**
 * Calculate the next generation date based on frequency
 */
function calculateNextGenerationDate(
  fromDate: Date,
  frequency: string,
  dayOfMonth: number,
  dayOfWeek: number
): Date {
  const next = new Date(fromDate);
  
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      // Adjust to specific day of week
      const currentDay = next.getDay();
      const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
      next.setDate(next.getDate() + daysUntilTarget);
      break;
      
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
      break;
      
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
      break;
      
    case 'semi_annual':
      next.setMonth(next.getMonth() + 6);
      next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
      break;
      
    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
      break;
  }
  
  return next;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Pause a recurring schedule
 * Called by: Admin via Admin Dashboard
 */
export async function pauseSchedule(scheduleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.execute(sql`
    UPDATE recurring_invoice_schedules
    SET status = 'paused', updatedAt = NOW()
    WHERE id = ${scheduleId}
  `);
  
  console.log(`[RecurringInvoices] Paused schedule ${scheduleId}`);
}

/**
 * Resume a paused schedule
 * Called by: Admin via Admin Dashboard
 */
export async function resumeSchedule(scheduleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Recalculate next generation date from today
  const [schedules] = await db.execute(sql`
    SELECT * FROM recurring_invoice_schedules WHERE id = ${scheduleId}
  `);
  
  const schedule = (schedules as any[])[0];
  if (!schedule) throw new Error('Schedule not found');

  const nextDate = calculateNextGenerationDate(
    new Date(),
    schedule.frequency,
    schedule.dayOfMonth,
    schedule.dayOfWeek
  );

  await db.execute(sql`
    UPDATE recurring_invoice_schedules
    SET status = 'active',
        nextGenerationDate = ${nextDate.toISOString().split('T')[0]},
        updatedAt = NOW()
    WHERE id = ${scheduleId}
  `);
  
  console.log(`[RecurringInvoices] Resumed schedule ${scheduleId}`);
}

/**
 * Cancel a recurring schedule
 * Called by: Admin via Admin Dashboard
 */
export async function cancelSchedule(scheduleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.execute(sql`
    UPDATE recurring_invoice_schedules
    SET status = 'cancelled', updatedAt = NOW()
    WHERE id = ${scheduleId}
  `);
  
  console.log(`[RecurringInvoices] Cancelled schedule ${scheduleId}`);
}

/**
 * List recurring schedules for a customer
 * Called by: Admin Dashboard or Customer Portal (read-only for customers)
 */
export async function listSchedules(params: {
  customerId?: number;
  organizationId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<RecurringSchedule[]> {
  const db = await getDb();
  if (!db) return [];

  let query = sql`SELECT * FROM recurring_invoice_schedules WHERE 1=1`;
  
  if (params.customerId) {
    query = sql`${query} AND customerId = ${params.customerId}`;
  }
  if (params.organizationId) {
    query = sql`${query} AND organizationId = ${params.organizationId}`;
  }
  if (params.status) {
    query = sql`${query} AND status = ${params.status}`;
  }
  
  query = sql`${query} ORDER BY createdAt DESC`;
  
  if (params.limit) {
    query = sql`${query} LIMIT ${params.limit}`;
  }
  if (params.offset) {
    query = sql`${query} OFFSET ${params.offset}`;
  }

  const [schedules] = await db.execute(query);
  return schedules as RecurringSchedule[];
}

/**
 * Get schedule details with line items
 */
export async function getScheduleDetails(scheduleId: number): Promise<{
  schedule: RecurringSchedule;
  lineItems: RecurringLineItem[];
  generationHistory: any[];
} | null> {
  const db = await getDb();
  if (!db) return null;

  const [schedules] = await db.execute(sql`
    SELECT * FROM recurring_invoice_schedules WHERE id = ${scheduleId}
  `);
  
  const schedule = (schedules as any[])[0];
  if (!schedule) return null;

  const [items] = await db.execute(sql`
    SELECT * FROM recurring_invoice_items WHERE scheduleId = ${scheduleId} ORDER BY sortOrder
  `);

  const [history] = await db.execute(sql`
    SELECT g.*, i.invoiceNumber, i.total, i.status as invoiceStatus
    FROM recurring_invoice_generations g
    JOIN invoices i ON g.invoiceId = i.id
    WHERE g.scheduleId = ${scheduleId}
    ORDER BY g.generatedAt DESC
    LIMIT 10
  `);

  return {
    schedule,
    lineItems: items as RecurringLineItem[],
    generationHistory: history as any[]
  };
}


/**
 * Delete a recurring schedule (soft delete by setting status to cancelled)
 * Called by: Admin via Admin Dashboard
 */
export async function deleteRecurringSchedule(scheduleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // First check if schedule exists
  const [schedules] = await db.execute(sql`
    SELECT id FROM recurring_invoice_schedules WHERE id = ${scheduleId}
  `);
  
  if ((schedules as any[]).length === 0) {
    throw new Error('Schedule not found');
  }

  // Soft delete by setting status to cancelled
  await db.execute(sql`
    UPDATE recurring_invoice_schedules
    SET status = 'cancelled', updatedAt = NOW()
    WHERE id = ${scheduleId}
  `);
  
  console.log(`[RecurringInvoices] Deleted (cancelled) schedule ${scheduleId}`);
}

/**
 * Update a recurring schedule
 * Called by: Admin via Admin Dashboard
 */
export async function updateRecurringSchedule(params: {
  scheduleId: number;
  name?: string;
  description?: string;
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  dayOfMonth?: number;
  dayOfWeek?: number;
  endDate?: Date | null;
  currency?: string;
  taxRate?: number;
  paymentTermsDays?: number;
  notes?: string;
  lineItems?: Array<{
    id?: number;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }
  if (params.description !== undefined) {
    updates.push('description = ?');
    values.push(params.description);
  }
  if (params.frequency !== undefined) {
    updates.push('frequency = ?');
    values.push(params.frequency);
  }
  if (params.dayOfMonth !== undefined) {
    updates.push('dayOfMonth = ?');
    values.push(params.dayOfMonth);
  }
  if (params.dayOfWeek !== undefined) {
    updates.push('dayOfWeek = ?');
    values.push(params.dayOfWeek);
  }
  if (params.endDate !== undefined) {
    updates.push('endDate = ?');
    values.push(params.endDate ? params.endDate.toISOString().split('T')[0] : null);
  }
  if (params.currency !== undefined) {
    updates.push('currency = ?');
    values.push(params.currency);
  }
  if (params.taxRate !== undefined) {
    updates.push('taxRate = ?');
    values.push(params.taxRate);
  }
  if (params.paymentTermsDays !== undefined) {
    updates.push('paymentTermsDays = ?');
    values.push(params.paymentTermsDays);
  }
  if (params.notes !== undefined) {
    updates.push('notes = ?');
    values.push(params.notes);
  }

  if (updates.length > 0) {
    updates.push('updatedAt = NOW()');
    await db.execute(sql`
      UPDATE recurring_invoice_schedules
      SET ${sql.raw(updates.join(', '))}
      WHERE id = ${params.scheduleId}
    `);
  }

  // Update line items if provided
  if (params.lineItems) {
    // Delete existing items
    await db.execute(sql`
      DELETE FROM recurring_invoice_items WHERE scheduleId = ${params.scheduleId}
    `);

    // Insert new items
    for (let i = 0; i < params.lineItems.length; i++) {
      const item = params.lineItems[i];
      await db.execute(sql`
        INSERT INTO recurring_invoice_items (
          scheduleId, description, quantity, unitPrice, taxRate, sortOrder
        ) VALUES (
          ${params.scheduleId},
          ${item.description},
          ${item.quantity},
          ${item.unitPrice},
          ${item.taxRate || 0},
          ${i}
        )
      `);
    }
  }

  console.log(`[RecurringInvoices] Updated schedule ${params.scheduleId}`);
}
