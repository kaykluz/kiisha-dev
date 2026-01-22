/**
 * Seed script to populate sample assets with classification data
 * Run with: node scripts/seed-assets.mjs
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Parse connection string
const url = new URL(DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

console.log('Connected to database');

// First check if we have projects
const [projects] = await connection.execute('SELECT * FROM projects LIMIT 5');
let projectIds = projects.map(p => p.id);

if (projectIds.length === 0) {
  console.log('No projects found. Creating a sample project...');
  // First create a portfolio
  const [portfolioResult] = await connection.execute(
    `INSERT INTO portfolios (name, description, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`,
    ['Africa Portfolio', 'Sample portfolio for testing']
  );
  const portfolioId = portfolioResult.insertId;
  
  // Create a project
  const [projectResult] = await connection.execute(
    `INSERT INTO projects (portfolioId, name, code, state, technology, capacityMw, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [portfolioId, 'Sample Energy Project', 'SEP-001', 'Lagos', 'PV+BESS', '10.0']
  );
  projectIds.push(projectResult.insertId);
  console.log(`Created project with ID ${projectResult.insertId}`);
}

// Check for sites
const [sites] = await connection.execute('SELECT * FROM sites LIMIT 5');
let siteIds = sites.map(s => s.id);

// Create sample sites if none exist
if (siteIds.length === 0) {
  console.log('Creating sample sites...');
  const sampleSites = [
    { name: 'Lagos Solar Farm', siteCode: 'LGS', country: 'Nigeria', city: 'Lagos', latitude: 6.5244, longitude: 3.3792, capacityKw: '5000' },
    { name: 'Nairobi Mini-Grid', siteCode: 'NRB', country: 'Kenya', city: 'Nairobi', latitude: -1.2921, longitude: 36.8219, capacityKw: '2500' },
    { name: 'Accra Commercial', siteCode: 'ACC', country: 'Ghana', city: 'Accra', latitude: 5.6037, longitude: -0.1870, capacityKw: '1500' },
    { name: 'Kigali Industrial', siteCode: 'KGL', country: 'Rwanda', city: 'Kigali', latitude: -1.9403, longitude: 29.8739, capacityKw: '3000' },
    { name: 'Dar es Salaam Mesh', siteCode: 'DAR', country: 'Tanzania', city: 'Dar es Salaam', latitude: -6.7924, longitude: 39.2083, capacityKw: '4000' },
  ];
  
  for (const site of sampleSites) {
    const projectId = projectIds[Math.floor(Math.random() * projectIds.length)];
    const [result] = await connection.execute(
      `INSERT INTO sites (projectId, name, siteCode, country, city, latitude, longitude, capacityKw, status, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [projectId, site.name, site.siteCode, site.country, site.city, site.latitude, site.longitude, site.capacityKw]
    );
    siteIds.push(result.insertId);
  }
  console.log(`Created ${sampleSites.length} sites`);
}

// Check for systems
const [systems] = await connection.execute('SELECT * FROM systems LIMIT 20');
let systemIds = systems.map(s => s.id);

// Create sample systems if none exist
if (systemIds.length === 0) {
  console.log('Creating sample systems...');
  const systemTypes = ['pv', 'bess', 'genset']; // Must match schema enum
  
  for (const siteId of siteIds) {
    for (const systemType of systemTypes.slice(0, 3)) { // 3 systems per site
      const [result] = await connection.execute(
        `INSERT INTO systems (siteId, name, systemType, status, createdAt, updatedAt) 
         VALUES (?, ?, ?, 'active', NOW(), NOW())`,
        [siteId, `${systemType.toUpperCase()} System`, systemType]
      );
      systemIds.push(result.insertId);
    }
  }
  console.log(`Created ${systemIds.length} systems`);
}

// Sample asset data with classifications
const sampleAssets = [
  // Residential / Off-grid / PV Only
  { name: 'INV-RES-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'residential', gridConnectionType: 'off_grid', networkTopology: 'radial', configurationProfile: 'pv_only', manufacturer: 'Victron', model: 'MultiPlus 3000', nominalCapacityKw: '3' },
  { name: 'PNL-RES-001', assetType: 'panel', assetCategory: 'generation', assetClassification: 'residential', gridConnectionType: 'off_grid', networkTopology: 'radial', configurationProfile: 'pv_only', manufacturer: 'JA Solar', model: 'JAM72S30-545', nominalCapacityKw: '0.545' },
  { name: 'BAT-RES-001', assetType: 'battery', assetCategory: 'storage', assetClassification: 'residential', gridConnectionType: 'off_grid', networkTopology: 'radial', configurationProfile: 'pv_bess', manufacturer: 'BYD', model: 'B-Box Premium', nominalCapacityKw: '5' },
  
  // Small Commercial / Grid-Tied / PV+BESS
  { name: 'INV-SMC-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'small_commercial', gridConnectionType: 'grid_tied_with_backup', networkTopology: 'radial', configurationProfile: 'pv_bess', manufacturer: 'SMA', model: 'Sunny Tripower 25000TL', nominalCapacityKw: '25' },
  { name: 'INV-SMC-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'small_commercial', gridConnectionType: 'grid_tied_with_backup', networkTopology: 'radial', configurationProfile: 'pv_bess', manufacturer: 'SMA', model: 'Sunny Tripower 25000TL', nominalCapacityKw: '25' },
  { name: 'BAT-SMC-001', assetType: 'battery', assetCategory: 'storage', assetClassification: 'small_commercial', gridConnectionType: 'grid_tied_with_backup', networkTopology: 'radial', configurationProfile: 'pv_bess', manufacturer: 'Tesla', model: 'Powerpack', nominalCapacityKw: '50' },
  
  // Large Commercial / Grid Connected / PV+BESS+DG
  { name: 'INV-LGC-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'large_commercial', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_bess_dg', manufacturer: 'Huawei', model: 'SUN2000-100KTL', nominalCapacityKw: '100' },
  { name: 'INV-LGC-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'large_commercial', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_bess_dg', manufacturer: 'Huawei', model: 'SUN2000-100KTL', nominalCapacityKw: '100' },
  { name: 'GEN-LGC-001', assetType: 'genset', assetCategory: 'generation', assetClassification: 'large_commercial', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_bess_dg', manufacturer: 'Caterpillar', model: 'C15', nominalCapacityKw: '500' },
  { name: 'BAT-LGC-001', assetType: 'battery', assetCategory: 'storage', assetClassification: 'large_commercial', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_bess_dg', manufacturer: 'LG Chem', model: 'RESU16H Prime', nominalCapacityKw: '200' },
  
  // Industrial / Grid Connected / Hybrid
  { name: 'INV-IND-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'industrial', gridConnectionType: 'grid_connected', networkTopology: 'mesh', configurationProfile: 'hybrid_custom', manufacturer: 'ABB', model: 'TRIO-50.0-TL', nominalCapacityKw: '500' },
  { name: 'INV-IND-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'industrial', gridConnectionType: 'grid_connected', networkTopology: 'mesh', configurationProfile: 'hybrid_custom', manufacturer: 'ABB', model: 'TRIO-50.0-TL', nominalCapacityKw: '500' },
  { name: 'TRF-IND-001', assetType: 'transformer', assetCategory: 'distribution', assetClassification: 'industrial', gridConnectionType: 'grid_connected', networkTopology: 'mesh', configurationProfile: 'hybrid_custom', manufacturer: 'Siemens', model: 'GEAFOL', nominalCapacityKw: '2000' },
  
  // Mini-Grid / Off-Grid / PV+BESS+DG
  { name: 'INV-MG-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'mini_grid', gridConnectionType: 'mini_grid', networkTopology: 'radial', configurationProfile: 'minigrid_pv_bess_dg', manufacturer: 'Studer', model: 'Xtender XTH', nominalCapacityKw: '50' },
  { name: 'INV-MG-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'mini_grid', gridConnectionType: 'mini_grid', networkTopology: 'radial', configurationProfile: 'minigrid_pv_bess_dg', manufacturer: 'Studer', model: 'Xtender XTH', nominalCapacityKw: '50' },
  { name: 'BAT-MG-001', assetType: 'battery', assetCategory: 'storage', assetClassification: 'mini_grid', gridConnectionType: 'mini_grid', networkTopology: 'radial', configurationProfile: 'minigrid_pv_bess_dg', manufacturer: 'Pylontech', model: 'US3000C', nominalCapacityKw: '100' },
  { name: 'GEN-MG-001', assetType: 'genset', assetCategory: 'generation', assetClassification: 'mini_grid', gridConnectionType: 'mini_grid', networkTopology: 'radial', configurationProfile: 'minigrid_pv_bess_dg', manufacturer: 'Cummins', model: 'C50D5', nominalCapacityKw: '50' },
  { name: 'MTR-MG-001', assetType: 'meter', assetCategory: 'monitoring', assetClassification: 'mini_grid', gridConnectionType: 'mini_grid', networkTopology: 'radial', configurationProfile: 'minigrid_pv_bess_dg', manufacturer: 'Schneider', model: 'PM5560', nominalCapacityKw: null },
  
  // Mesh Grid / Interconnected / Mesh PV+BESS
  { name: 'INV-MSH-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'mesh_grid', gridConnectionType: 'mesh_grid', networkTopology: 'mesh', configurationProfile: 'mesh_pv_bess', manufacturer: 'Fronius', model: 'Symo GEN24', nominalCapacityKw: '10' },
  { name: 'INV-MSH-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'mesh_grid', gridConnectionType: 'mesh_grid', networkTopology: 'mesh', configurationProfile: 'mesh_pv_bess', manufacturer: 'Fronius', model: 'Symo GEN24', nominalCapacityKw: '10' },
  { name: 'INV-MSH-003', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'mesh_grid', gridConnectionType: 'mesh_grid', networkTopology: 'mesh', configurationProfile: 'mesh_pv_bess', manufacturer: 'Fronius', model: 'Symo GEN24', nominalCapacityKw: '10' },
  { name: 'BAT-MSH-001', assetType: 'battery', assetCategory: 'storage', assetClassification: 'mesh_grid', gridConnectionType: 'mesh_grid', networkTopology: 'mesh', configurationProfile: 'mesh_pv_bess', manufacturer: 'Enphase', model: 'IQ Battery 10T', nominalCapacityKw: '30' },
  
  // Interconnected Mini-Grids
  { name: 'INV-IMG-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'interconnected_mini_grids', gridConnectionType: 'interconnected_mini_grid', networkTopology: 'star', configurationProfile: 'minigrid_pv_bess', manufacturer: 'SolarEdge', model: 'SE100K', nominalCapacityKw: '100' },
  { name: 'INV-IMG-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'interconnected_mini_grids', gridConnectionType: 'interconnected_mini_grid', networkTopology: 'star', configurationProfile: 'minigrid_pv_bess', manufacturer: 'SolarEdge', model: 'SE100K', nominalCapacityKw: '100' },
  { name: 'BAT-IMG-001', assetType: 'battery', assetCategory: 'storage', assetClassification: 'interconnected_mini_grids', gridConnectionType: 'interconnected_mini_grid', networkTopology: 'star', configurationProfile: 'minigrid_pv_bess', manufacturer: 'Samsung SDI', model: 'E3-R186', nominalCapacityKw: '150' },
  { name: 'SWG-IMG-001', assetType: 'switchgear', assetCategory: 'distribution', assetClassification: 'interconnected_mini_grids', gridConnectionType: 'interconnected_mini_grid', networkTopology: 'star', configurationProfile: 'minigrid_pv_bess', manufacturer: 'ABB', model: 'UniGear ZS1', nominalCapacityKw: null },
  
  // Grid Connected / Utility Scale
  { name: 'INV-GC-001', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'grid_connected', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_only', manufacturer: 'TMEIC', model: 'Solar Ware Samurai', nominalCapacityKw: '1500' },
  { name: 'INV-GC-002', assetType: 'inverter', assetCategory: 'generation', assetClassification: 'grid_connected', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_only', manufacturer: 'TMEIC', model: 'Solar Ware Samurai', nominalCapacityKw: '1500' },
  { name: 'TRF-GC-001', assetType: 'transformer', assetCategory: 'distribution', assetClassification: 'grid_connected', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_only', manufacturer: 'GE', model: 'Prolec', nominalCapacityKw: '5000' },
  { name: 'MON-GC-001', assetType: 'monitoring', assetCategory: 'monitoring', assetClassification: 'grid_connected', gridConnectionType: 'grid_connected', networkTopology: 'ring', configurationProfile: 'pv_only', manufacturer: 'AlsoEnergy', model: 'PowerTrack', nominalCapacityKw: null },
];

// Insert assets
console.log('Inserting sample assets...');
let insertedCount = 0;

for (const asset of sampleAssets) {
  // Pick a random site and system
  const siteId = siteIds[Math.floor(Math.random() * siteIds.length)];
  const systemId = systemIds[Math.floor(Math.random() * systemIds.length)];
  
  // Generate VATR ID
  const vatrId = `VATR-${asset.name}`;
  
  try {
    await connection.execute(
      `INSERT INTO assets (
        siteId, systemId, vatrId, name, assetType, assetCategory,
        assetClassification, gridConnectionType, networkTopology, configurationProfile,
        manufacturer, model, nominalCapacityKw, status, \`condition\`,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'good', NOW(), NOW())`,
      [
        siteId, systemId, vatrId, asset.name, asset.assetType, asset.assetCategory,
        asset.assetClassification, asset.gridConnectionType, asset.networkTopology, asset.configurationProfile,
        asset.manufacturer, asset.model, asset.nominalCapacityKw
      ]
    );
    insertedCount++;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log(`Asset ${asset.name} already exists, skipping...`);
    } else {
      console.error(`Error inserting ${asset.name}:`, err.message);
    }
  }
}

console.log(`Inserted ${insertedCount} assets`);

// Show summary
const [summary] = await connection.execute(`
  SELECT 
    assetClassification,
    COUNT(*) as count
  FROM assets 
  WHERE assetClassification IS NOT NULL
  GROUP BY assetClassification
  ORDER BY count DESC
`);

console.log('\nAsset Classification Summary:');
console.table(summary);

const [configSummary] = await connection.execute(`
  SELECT 
    configurationProfile,
    COUNT(*) as count
  FROM assets 
  WHERE configurationProfile IS NOT NULL
  GROUP BY configurationProfile
  ORDER BY count DESC
`);

console.log('\nConfiguration Profile Summary:');
console.table(configSummary);

await connection.end();
console.log('\nDone!');
