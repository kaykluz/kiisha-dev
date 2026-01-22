/**
 * Verify Asset Data Script
 * Proves the seeded data is correct with SQL queries
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('\n=== KIISHA Asset Verification Report ===\n');

  // 1. Total project-level assets
  const [totalAssets] = await db.execute(sql`
    SELECT COUNT(*) as total FROM projects WHERE country IS NOT NULL
  `);
  console.log('1. TOTAL PROJECT-LEVEL ASSETS:', totalAssets[0].total);

  // 2. Assets by country
  console.log('\n2. ASSETS BY COUNTRY:');
  const assetsByCountry = await db.execute(sql`
    SELECT 
      country, 
      COUNT(*) as asset_count, 
      ROUND(SUM(capacityMw), 1) as total_mw,
      GROUP_CONCAT(DISTINCT assetClassification) as classifications
    FROM projects 
    WHERE country IS NOT NULL 
    GROUP BY country 
    ORDER BY asset_count DESC
  `);
  console.table(assetsByCountry[0]);

  // 3. Assets by classification
  console.log('\n3. ASSETS BY CLASSIFICATION:');
  const assetsByClassification = await db.execute(sql`
    SELECT 
      assetClassification, 
      COUNT(*) as count,
      ROUND(SUM(capacityMw), 1) as total_mw
    FROM projects 
    WHERE assetClassification IS NOT NULL 
    GROUP BY assetClassification 
    ORDER BY count DESC
  `);
  console.table(assetsByClassification[0]);

  // 4. Assets by status (lifecycle stage)
  console.log('\n4. ASSETS BY LIFECYCLE STAGE:');
  const assetsByStatus = await db.execute(sql`
    SELECT 
      status, 
      COUNT(*) as count
    FROM projects 
    WHERE country IS NOT NULL 
    GROUP BY status 
    ORDER BY count DESC
  `);
  console.table(assetsByStatus[0]);

  // 5. Components (equipment) count
  console.log('\n5. COMPONENTS (EQUIPMENT) COUNT:');
  const [componentCount] = await db.execute(sql`
    SELECT COUNT(*) as total FROM assets
  `);
  console.log('Total components:', componentCount[0].total);

  // 6. Components grouped by system
  console.log('\n6. COMPONENTS BY SYSTEM:');
  const componentsBySystem = await db.execute(sql`
    SELECT 
      s.name as system_name,
      COUNT(a.id) as component_count
    FROM assets a
    JOIN systems s ON a.systemId = s.id
    GROUP BY s.id, s.name
    ORDER BY component_count DESC
    LIMIT 10
  `);
  console.table(componentsBySystem[0]);

  // 7. Sample assets with all classification fields
  console.log('\n7. SAMPLE ASSETS WITH CLASSIFICATION FIELDS:');
  const sampleAssets = await db.execute(sql`
    SELECT 
      id,
      name,
      country,
      assetClassification,
      gridConnectionType,
      configurationProfile,
      networkTopology,
      status,
      capacityMw
    FROM projects 
    WHERE country IS NOT NULL 
    LIMIT 10
  `);
  console.table(sampleAssets[0]);

  await connection.end();
  console.log('\n=== Verification Complete ===\n');
}

main().catch(console.error);
