/**
 * Script to create a new organization with an admin user
 * 
 * Usage: npx tsx scripts/seed-organization.ts <org_name> <org_code> <admin_email>
 * 
 * Example: npx tsx scripts/seed-organization.ts "MBBENT11" "mbbent11" "mbbent11@gmail.com"
 * 
 * This script will:
 * 1. Create a new organization
 * 2. Create or find the admin user
 * 3. Add the user as an admin member of the organization
 * 
 * The new user will see a blank profile with no prefilled data.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import * as schema from "../drizzle/schema";

const { users, organizations, organizationMembers } = schema;

async function seedOrganization(orgName: string, orgCode: string, adminEmail: string) {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  if (!orgName || !orgCode || !adminEmail) {
    console.error("ERROR: Please provide all required arguments");
    console.log("Usage: npx tsx scripts/seed-organization.ts <org_name> <org_code> <admin_email>");
    console.log("Example: npx tsx scripts/seed-organization.ts \"MBBENT11\" \"mbbent11\" \"mbbent11@gmail.com\"");
    process.exit(1);
  }

  console.log(`\n🚀 Starting organization setup...`);
  console.log(`   Organization: ${orgName}`);
  console.log(`   Code: ${orgCode}`);
  console.log(`   Admin Email: ${adminEmail}\n`);

  const db = drizzle(process.env.DATABASE_URL, { schema, mode: "default" });

  // Step 1: Check if organization already exists
  console.log(`1. Checking if organization "${orgCode}" exists...`);
  const [existingOrg] = await db.select().from(organizations).where(eq(organizations.code, orgCode));
  
  let org;
  if (existingOrg) {
    console.log(`   ⚠️  Organization already exists (ID: ${existingOrg.id})`);
    org = existingOrg;
  } else {
    // Create new organization
    console.log(`   Creating new organization...`);
    const [result] = await db.insert(organizations).values({
      name: orgName,
      code: orgCode,
      slug: orgCode.toLowerCase(),
      description: `${orgName} organization`,
      signupMode: "invite_only",
      status: "active",
    });
    
    const [newOrg] = await db.select().from(organizations).where(eq(organizations.code, orgCode));
    org = newOrg;
    console.log(`   ✅ Organization created (ID: ${org.id})`);
  }

  // Step 2: Check if user exists or create pre-approved membership
  console.log(`\n2. Setting up admin user "${adminEmail}"...`);
  const [existingUser] = await db.select().from(users).where(eq(users.email, adminEmail));
  
  let userId: number | null = null;
  if (existingUser) {
    console.log(`   Found existing user (ID: ${existingUser.id})`);
    userId = existingUser.id;
  } else {
    console.log(`   User doesn't exist yet - will create pre-approved membership`);
  }

  // Step 3: Check if membership already exists
  console.log(`\n3. Setting up organization membership...`);
  
  let membershipQuery;
  if (userId) {
    membershipQuery = and(
      eq(organizationMembers.organizationId, org.id),
      eq(organizationMembers.userId, userId)
    );
  } else {
    membershipQuery = and(
      eq(organizationMembers.organizationId, org.id),
      eq(organizationMembers.preApprovedEmail, adminEmail)
    );
  }
  
  const [existingMembership] = await db.select().from(organizationMembers).where(membershipQuery);
  
  if (existingMembership) {
    console.log(`   ⚠️  Membership already exists (ID: ${existingMembership.id})`);
    
    // Update to admin if not already
    if (existingMembership.role !== 'admin') {
      await db.update(organizationMembers)
        .set({ role: 'admin', status: 'active' })
        .where(eq(organizationMembers.id, existingMembership.id));
      console.log(`   ✅ Updated membership role to admin`);
    }
  } else {
    // Create new membership
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: userId,
      preApprovedEmail: userId ? null : adminEmail,
      role: "admin",
      status: userId ? "active" : "pending",
      invitedAt: new Date(),
    });
    console.log(`   ✅ Created admin membership`);
  }

  // Step 4: If user exists, update their role to 'admin' (org-level admin, not superuser)
  if (existingUser && existingUser.role !== 'admin' && existingUser.role !== 'superuser_admin') {
    console.log(`\n4. Updating user role to admin...`);
    await db.update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, existingUser.id));
    console.log(`   ✅ User role updated to admin`);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ SETUP COMPLETE!`);
  console.log(`${"=".repeat(50)}`);
  console.log(`\nOrganization: ${org.name} (${org.code})`);
  console.log(`Organization ID: ${org.id}`);
  console.log(`Admin Email: ${adminEmail}`);
  
  if (userId) {
    console.log(`User ID: ${userId}`);
    console.log(`\nThe user can now log in and will see their organization.`);
  } else {
    console.log(`\nThe user has been pre-approved. When they sign up with`);
    console.log(`${adminEmail}, they will automatically be added to the`);
    console.log(`organization as an admin with a blank profile.`);
  }
  
  console.log(`\n${"=".repeat(50)}\n`);

  process.exit(0);
}

// Get arguments from command line
const orgName = process.argv[2];
const orgCode = process.argv[3];
const adminEmail = process.argv[4];

seedOrganization(orgName, orgCode, adminEmail).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
