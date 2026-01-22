/**
 * Seed Test Customer Script
 * 
 * Creates a test customer account for testing the customer portal.
 * 
 * Test Credentials:
 * - Email: test@customer.com
 * - Password: TestCustomer123!
 * 
 * Run with: npx tsx server/scripts/seedTestCustomer.ts
 */

import { getDb } from "../db";
import { customers, customerUsers, customerProjects } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedTestCustomer() {
  console.log("🌱 Seeding test customer...\n");
  
  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available");
    process.exit(1);
  }
  
  const TEST_EMAIL = "test@customer.com";
  const TEST_PASSWORD = "TestCustomer123!";
  const TEST_CUSTOMER_CODE = "TEST-CUST-001";
  const ORG_ID = 1; // Default organization
  
  try {
    // Check if test customer already exists
    const [existingCustomer] = await db.select()
      .from(customers)
      .where(eq(customers.code, TEST_CUSTOMER_CODE))
      .limit(1);
    
    let customerId: number;
    
    if (existingCustomer) {
      console.log("📋 Test customer already exists, updating...");
      customerId = existingCustomer.id;
    } else {
      // Create test customer
      console.log("📋 Creating test customer...");
      await db.insert(customers).values({
        organizationId: ORG_ID,
        code: TEST_CUSTOMER_CODE,
        name: "Test Customer",
        companyName: "Acme Solar Corp",
        email: TEST_EMAIL,
        phone: "+1 234 567 8900",
        address: "123 Solar Street",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        postalCode: "100001",
        billingEmail: TEST_EMAIL,
        currency: "USD",
        paymentTermsDays: 30,
        status: "active",
        notes: "Test customer account for portal testing",
      });
      
      // Fetch the newly created customer to get the ID
      const [newCustomer] = await db.select()
        .from(customers)
        .where(eq(customers.code, TEST_CUSTOMER_CODE))
        .limit(1);
      
      customerId = newCustomer.id;
      console.log(`✅ Created customer with ID: ${customerId}`);
    }
    
    // Check if customer user already exists
    const [existingUser] = await db.select()
      .from(customerUsers)
      .where(and(
        eq(customerUsers.customerId, customerId),
        eq(customerUsers.email, TEST_EMAIL)
      ))
      .limit(1);
    
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    if (existingUser) {
      console.log("👤 Test customer user already exists, updating password...");
      await db.update(customerUsers)
        .set({
          passwordHash,
          status: "active",
          emailVerified: true,
        })
        .where(eq(customerUsers.id, existingUser.id));
      console.log(`✅ Updated customer user ID: ${existingUser.id}`);
    } else {
      // Create customer user with password
      console.log("👤 Creating customer user...");
      await db.insert(customerUsers).values({
        customerId,
        email: TEST_EMAIL,
        passwordHash,
        name: "Test User",
        role: "owner",
        status: "active",
        emailVerified: true,
        notifyInvoices: true,
        notifyPayments: true,
        notifyReports: true,
      });
      
      // Fetch the newly created user
      const [newUser] = await db.select()
        .from(customerUsers)
        .where(and(
          eq(customerUsers.customerId, customerId),
          eq(customerUsers.email, TEST_EMAIL)
        ))
        .limit(1);
      
      console.log(`✅ Created customer user with ID: ${newUser.id}`);
    }
    
    // Link to a sample project if one exists
    const [existingLink] = await db.select()
      .from(customerProjects)
      .where(eq(customerProjects.customerId, customerId))
      .limit(1);
    
    if (!existingLink) {
      console.log("🔗 Linking customer to sample project...");
      try {
        await db.insert(customerProjects).values({
          customerId,
          projectId: 1, // Link to first project
          accessLevel: "full",
          billingCycle: "monthly",
          status: "active",
        });
        console.log("✅ Linked customer to project ID: 1");
      } catch (e) {
        console.log("⚠️  No project found to link (this is OK for testing)");
      }
    } else {
      console.log("🔗 Customer already linked to a project");
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Test customer seeded successfully!");
    console.log("=".repeat(50));
    console.log("\n📧 Test Portal Credentials:");
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log("\n🔗 Portal URL: /portal/login");
    console.log("=".repeat(50) + "\n");
    
  } catch (error) {
    console.error("❌ Error seeding test customer:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the seed function
seedTestCustomer();
