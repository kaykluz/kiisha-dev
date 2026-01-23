/**
 * Script to update a user to superuser status
 * 
 * Usage: npx tsx scripts/make-superuser.ts <email>
 * 
 * This script will:
 * 1. Find the user by email
 * 2. Set isSuperuser = true
 * 3. Set role = 'superuser_admin'
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";

const { users } = schema;

async function makeSuperuser(email: string) {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  if (!email) {
    console.error("ERROR: Please provide an email address");
    console.log("Usage: npx tsx scripts/make-superuser.ts <email>");
    process.exit(1);
  }

  console.log(`Connecting to database...`);
  const db = drizzle(process.env.DATABASE_URL, { schema, mode: "default" });

  console.log(`Looking for user with email: ${email}`);
  
  // Find the user
  const [user] = await db.select().from(users).where(eq(users.email, email));
  
  if (!user) {
    console.error(`ERROR: User with email "${email}" not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name || user.email} (ID: ${user.id})`);
  console.log(`Current status: isSuperuser=${user.isSuperuser}, role=${user.role}`);

  if (user.isSuperuser && user.role === 'superuser_admin') {
    console.log("User is already a superuser. No changes needed.");
    process.exit(0);
  }

  // Update the user
  console.log(`Updating user to superuser...`);
  await db.update(users)
    .set({
      isSuperuser: true,
      role: 'superuser_admin'
    })
    .where(eq(users.id, user.id));

  // Verify the update
  const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
  
  console.log(`\n✅ SUCCESS!`);
  console.log(`User "${updatedUser.name || updatedUser.email}" is now a superuser`);
  console.log(`New status: isSuperuser=${updatedUser.isSuperuser}, role=${updatedUser.role}`);
  
  process.exit(0);
}

// Get email from command line arguments
const email = process.argv[2];
makeSuperuser(email).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
