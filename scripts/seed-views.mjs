/**
 * Seed Portfolio Views Script
 * Creates two test views to demonstrate view-scoping:
 * - View A: 5 Nigerian assets (static view)
 * - View B: 10 assets from Kenya, Ghana, Tanzania (dynamic view)
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('\n=== Creating Portfolio Views ===\n');

  // Get some project IDs for static view
  const nigerianAssets = await db.execute(sql`
    SELECT id, name FROM projects 
    WHERE country = 'Nigeria' AND assetClassification IS NOT NULL
    ORDER BY id
    LIMIT 5
  `);
  
  console.log('Nigerian assets for View A:');
  console.table(nigerianAssets[0]);

  // Create View A: Static view with 5 Nigerian assets
  const viewAResult = await db.execute(sql`
    INSERT INTO portfolioViews (name, description, viewType, isPublic, filterCriteria)
    VALUES (
      'View A - Nigeria Industrial',
      'Static view containing 5 Nigerian industrial assets for testing view-scoping',
      'static',
      true,
      '{}'
    )
  `);
  
  const viewAId = viewAResult[0].insertId;
  console.log(`\nCreated View A with ID: ${viewAId}`);

  // Add assets to View A
  const assetIds = nigerianAssets[0].map(a => a.id);
  for (const assetId of assetIds) {
    await db.execute(sql`
      INSERT INTO viewAssets (viewId, projectId)
      VALUES (${viewAId}, ${assetId})
    `);
  }
  console.log(`Added ${assetIds.length} assets to View A`);

  // Create View B: Dynamic view with filter criteria for Kenya, Ghana, Tanzania
  const viewBResult = await db.execute(sql`
    INSERT INTO portfolioViews (name, description, viewType, isPublic, filterCriteria)
    VALUES (
      'View B - East & West Africa',
      'Dynamic view filtering assets from Kenya, Ghana, and Tanzania',
      'dynamic',
      true,
      '{"countries": ["Kenya", "Ghana", "Tanzania"]}'
    )
  `);
  
  const viewBId = viewBResult[0].insertId;
  console.log(`\nCreated View B with ID: ${viewBId}`);

  // Verify View B would return ~10 assets
  const viewBAssets = await db.execute(sql`
    SELECT id, name, country, assetClassification FROM projects 
    WHERE country IN ('Kenya', 'Ghana', 'Tanzania') AND assetClassification IS NOT NULL
    ORDER BY country, name
  `);
  
  console.log('\nAssets that would be in View B (dynamic):');
  console.table(viewBAssets[0]);

  // Summary
  console.log('\n=== View Summary ===');
  console.log(`View A (ID: ${viewAId}): Static, 5 Nigerian assets`);
  console.log(`View B (ID: ${viewBId}): Dynamic, ${viewBAssets[0].length} assets from Kenya/Ghana/Tanzania`);

  await connection.end();
  console.log('\n=== Views Created Successfully ===\n');
}

main().catch(console.error);
