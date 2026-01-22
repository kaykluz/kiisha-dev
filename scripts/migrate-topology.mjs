/**
 * Migrate Topology Script
 * Updates existing assets with couplingTopology and distributionTopology values
 * based on their assetClassification and configurationProfile
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('\n=== Migrating Topology Fields ===\n');

  // Get all assets with classification
  const assets = await db.execute(sql`
    SELECT id, name, assetClassification, configurationProfile, networkTopology
    FROM projects
    WHERE assetClassification IS NOT NULL
  `);

  console.log(`Found ${assets[0].length} assets to migrate\n`);

  for (const asset of assets[0]) {
    // Determine couplingTopology based on configurationProfile
    let couplingTopology = 'UNKNOWN';
    
    switch (asset.configurationProfile) {
      case 'solar_only':
      case 'genset_only':
        couplingTopology = 'NOT_APPLICABLE';
        break;
      case 'solar_bess':
        // Most solar+BESS are DC coupled for efficiency
        couplingTopology = 'DC_COUPLED';
        break;
      case 'solar_genset':
        // Solar+Genset typically AC coupled
        couplingTopology = 'AC_COUPLED';
        break;
      case 'solar_bess_genset':
      case 'hybrid':
        // Hybrid systems often use mixed coupling
        couplingTopology = 'HYBRID_COUPLED';
        break;
      case 'bess_only':
        couplingTopology = 'DC_COUPLED';
        break;
      default:
        couplingTopology = 'UNKNOWN';
    }

    // Determine distributionTopology based on assetClassification
    let distributionTopology = 'NOT_APPLICABLE';
    
    if (['mini_grid', 'mesh_grid', 'interconnected_mini_grids'].includes(asset.assetClassification)) {
      // For minigrids, use the legacy networkTopology or default to RADIAL
      switch (asset.networkTopology) {
        case 'radial':
          distributionTopology = 'RADIAL';
          break;
        case 'ring':
          distributionTopology = 'RING';
          break;
        case 'mesh':
          distributionTopology = 'MESH';
          break;
        case 'star':
          distributionTopology = 'STAR';
          break;
        default:
          distributionTopology = 'RADIAL'; // Default for minigrids
      }
    }

    // Update the asset
    await db.execute(sql`
      UPDATE projects
      SET couplingTopology = ${couplingTopology},
          distributionTopology = ${distributionTopology}
      WHERE id = ${asset.id}
    `);

    console.log(`Updated ${asset.name}: coupling=${couplingTopology}, distribution=${distributionTopology}`);
  }

  // Verify migration
  console.log('\n=== Migration Summary ===\n');
  
  const couplingStats = await db.execute(sql`
    SELECT couplingTopology, COUNT(*) as count
    FROM projects
    WHERE couplingTopology IS NOT NULL
    GROUP BY couplingTopology
    ORDER BY count DESC
  `);
  console.log('Coupling Topology Distribution:');
  console.table(couplingStats[0]);

  const distributionStats = await db.execute(sql`
    SELECT distributionTopology, COUNT(*) as count
    FROM projects
    WHERE distributionTopology IS NOT NULL
    GROUP BY distributionTopology
    ORDER BY count DESC
  `);
  console.log('Distribution Topology Distribution:');
  console.table(distributionStats[0]);

  await connection.end();
  console.log('\n=== Migration Complete ===\n');
}

main().catch(console.error);
