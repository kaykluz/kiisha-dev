/**
 * Migration Script: Legacy to Canonical Portal Model
 * 
 * This script migrates data from the legacy tables (customers, customerUsers, customerProjects)
 * to the canonical tables (clientAccounts, portalUsers, clientAccountMemberships, clientScopeGrants).
 * 
 * Run with: npx tsx server/scripts/migrateToCanonicalModel.ts
 */

import { getDb } from "../db";
import { 
  customers, 
  customerUsers, 
  customerProjects,
  clientAccounts,
  portalUsers,
  clientAccountMemberships,
  clientScopeGrants,
} from "../../drizzle/schema";
import { eq, sql, and } from "drizzle-orm";

async function migrateToCanonicalModel() {
  console.log("🚀 Starting migration to canonical portal model...\n");
  
  const db = await getDb();
  
  // Step 1: Migrate customers to clientAccounts
  console.log("📦 Step 1: Migrating customers to clientAccounts...");
  
  const existingCustomers = await db.select().from(customers);
  console.log(`   Found ${existingCustomers.length} customers to migrate`);
  
  let clientAccountsCreated = 0;
  const customerToClientMap = new Map<number, number>();
  
  for (const customer of existingCustomers) {
    // Check if already migrated
    const [existing] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.legacyCustomerId, customer.id))
      .limit(1);
    
    if (existing) {
      customerToClientMap.set(customer.id, existing.id);
      console.log(`   ⏭️  Customer ${customer.id} (${customer.name}) already migrated to clientAccount ${existing.id}`);
      continue;
    }
    
    // Create new client account using Drizzle insert
    await db.insert(clientAccounts).values({
      code: customer.code || `CLIENT-${customer.id}`,
      name: customer.name,
      legalName: customer.legalName || null,
      primaryEmail: customer.email || null,
      billingEmail: customer.billingEmail || null,
      phone: customer.phone || null,
      address: customer.address || null,
      city: customer.city || null,
      state: customer.state || null,
      country: customer.country || null,
      postalCode: customer.postalCode || null,
      timezone: customer.timezone || 'UTC',
      taxId: customer.taxId || null,
      currency: customer.currency || 'USD',
      paymentTermsDays: customer.paymentTermsDays || 30,
      stripeCustomerId: customer.stripeCustomerId || null,
      status: (customer.status as 'active' | 'inactive' | 'suspended') || 'active',
      notes: customer.notes || null,
      legacyCustomerId: customer.id,
    });
    
    // Get the inserted ID
    const [inserted] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.legacyCustomerId, customer.id))
      .limit(1);
    
    if (inserted) {
      customerToClientMap.set(customer.id, inserted.id);
      clientAccountsCreated++;
      console.log(`   ✅ Migrated customer ${customer.id} (${customer.name}) → clientAccount ${inserted.id}`);
    }
  }
  
  console.log(`   📊 Created ${clientAccountsCreated} new client accounts\n`);
  
  // Step 2: Migrate customerUsers to portalUsers
  console.log("👤 Step 2: Migrating customerUsers to portalUsers...");
  
  const existingCustomerUsers = await db.select().from(customerUsers);
  console.log(`   Found ${existingCustomerUsers.length} customer users to migrate`);
  
  let portalUsersCreated = 0;
  const customerUserToPortalMap = new Map<number, number>();
  
  for (const customerUser of existingCustomerUsers) {
    // Check if already migrated
    const [existing] = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.legacyCustomerUserId, customerUser.id))
      .limit(1);
    
    if (existing) {
      customerUserToPortalMap.set(customerUser.id, existing.id);
      console.log(`   ⏭️  CustomerUser ${customerUser.id} (${customerUser.email}) already migrated to portalUser ${existing.id}`);
      continue;
    }
    
    // Check if email already exists (different customer user)
    const [existingEmail] = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.email, customerUser.email))
      .limit(1);
    
    if (existingEmail) {
      customerUserToPortalMap.set(customerUser.id, existingEmail.id);
      console.log(`   ⚠️  CustomerUser ${customerUser.id} (${customerUser.email}) shares email with portalUser ${existingEmail.id}`);
      continue;
    }
    
    // Create new portal user using Drizzle insert
    await db.insert(portalUsers).values({
      email: customerUser.email,
      passwordHash: customerUser.passwordHash || null,
      name: customerUser.name || null,
      phone: customerUser.phone || null,
      emailVerified: customerUser.emailVerified || false,
      emailVerificationToken: customerUser.emailVerificationToken || null,
      emailVerificationExpires: customerUser.emailVerificationExpires || null,
      passwordResetToken: customerUser.passwordResetToken || null,
      passwordResetExpires: customerUser.passwordResetExpires || null,
      lastLoginAt: customerUser.lastLoginAt || null,
      lastLoginIp: customerUser.lastLoginIp || null,
      status: customerUser.status === 'active' ? 'active' : 'inactive',
      notifyInvoices: customerUser.notifyInvoices ?? true,
      notifyPayments: customerUser.notifyPayments ?? true,
      notifyReports: customerUser.notifyReports ?? true,
      notifyAlerts: true,
      legacyCustomerUserId: customerUser.id,
    });
    
    // Get the inserted ID
    const [inserted] = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.legacyCustomerUserId, customerUser.id))
      .limit(1);
    
    if (inserted) {
      customerUserToPortalMap.set(customerUser.id, inserted.id);
      portalUsersCreated++;
      console.log(`   ✅ Migrated customerUser ${customerUser.id} (${customerUser.email}) → portalUser ${inserted.id}`);
    }
  }
  
  console.log(`   📊 Created ${portalUsersCreated} new portal users\n`);
  
  // Step 3: Create clientAccountMemberships
  console.log("🔗 Step 3: Creating clientAccountMemberships...");
  
  let membershipsCreated = 0;
  
  for (const customerUser of existingCustomerUsers) {
    const portalUserId = customerUserToPortalMap.get(customerUser.id);
    const clientAccountId = customerToClientMap.get(customerUser.customerId);
    
    if (!portalUserId || !clientAccountId) {
      console.log(`   ⚠️  Skipping membership for customerUser ${customerUser.id} - missing mapping`);
      continue;
    }
    
    // Check if membership already exists
    const [existing] = await db
      .select()
      .from(clientAccountMemberships)
      .where(
        and(
          eq(clientAccountMemberships.clientAccountId, clientAccountId),
          eq(clientAccountMemberships.portalUserId, portalUserId)
        )
      )
      .limit(1);
    
    if (existing) {
      console.log(`   ⏭️  Membership already exists for portalUser ${portalUserId} ↔ clientAccount ${clientAccountId}`);
      continue;
    }
    
    // Map legacy role to canonical role
    const role = customerUser.role === 'admin' ? 'CLIENT_ADMIN' : 'VIEWER';
    
    await db.insert(clientAccountMemberships).values({
      clientAccountId,
      portalUserId,
      role: role as 'CLIENT_ADMIN' | 'FINANCE' | 'OPS' | 'VIEWER',
      status: 'active',
    });
    
    membershipsCreated++;
    console.log(`   ✅ Created membership: portalUser ${portalUserId} ↔ clientAccount ${clientAccountId} (${role})`);
  }
  
  console.log(`   📊 Created ${membershipsCreated} new memberships\n`);
  
  // Step 4: Migrate customerProjects to clientScopeGrants
  console.log("🎯 Step 4: Migrating customerProjects to clientScopeGrants...");
  
  const existingCustomerProjects = await db.select().from(customerProjects);
  console.log(`   Found ${existingCustomerProjects.length} customer projects to migrate`);
  
  let grantsCreated = 0;
  
  for (const customerProject of existingCustomerProjects) {
    const clientAccountId = customerToClientMap.get(customerProject.customerId);
    
    if (!clientAccountId) {
      console.log(`   ⚠️  Skipping grant for customerProject ${customerProject.id} - missing client account mapping`);
      continue;
    }
    
    // Get the customer to find orgId
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerProject.customerId))
      .limit(1);
    
    const orgId = customer?.organizationId || 1; // Default to org 1 if not set
    
    // Check if grant already exists
    const [existing] = await db
      .select()
      .from(clientScopeGrants)
      .where(
        and(
          eq(clientScopeGrants.clientAccountId, clientAccountId),
          eq(clientScopeGrants.grantType, 'PROJECT'),
          eq(clientScopeGrants.orgId, orgId),
          eq(clientScopeGrants.targetId, customerProject.projectId)
        )
      )
      .limit(1);
    
    if (existing) {
      console.log(`   ⏭️  Grant already exists for clientAccount ${clientAccountId} → project ${customerProject.projectId}`);
      continue;
    }
    
    await db.insert(clientScopeGrants).values({
      clientAccountId,
      grantType: 'PROJECT',
      orgId,
      targetId: customerProject.projectId,
      accessLevel: (customerProject.accessLevel as 'full' | 'limited' | 'reports_only') || 'full',
      contractStartDate: customerProject.contractStartDate || null,
      contractEndDate: customerProject.contractEndDate || null,
      contractValue: customerProject.contractValue?.toString() || null,
      billingCycle: (customerProject.billingCycle as 'monthly' | 'quarterly' | 'annually' | 'one_time') || null,
      nextBillingDate: customerProject.nextBillingDate || null,
      status: (customerProject.status as 'active' | 'paused' | 'terminated' | 'expired') || 'active',
      legacyCustomerProjectId: customerProject.id,
    });
    
    grantsCreated++;
    console.log(`   ✅ Created grant: clientAccount ${clientAccountId} → PROJECT ${customerProject.projectId}`);
  }
  
  console.log(`   📊 Created ${grantsCreated} new scope grants\n`);
  
  // Summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎉 Migration completed successfully!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`   Client Accounts created: ${clientAccountsCreated}`);
  console.log(`   Portal Users created: ${portalUsersCreated}`);
  console.log(`   Memberships created: ${membershipsCreated}`);
  console.log(`   Scope Grants created: ${grantsCreated}`);
  console.log("═══════════════════════════════════════════════════════════\n");
  
  process.exit(0);
}

// Run migration
migrateToCanonicalModel().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
