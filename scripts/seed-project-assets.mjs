/**
 * Seed script for 30 project-level assets (investable units)
 * These are the primary "Assets" in KIISHA terminology
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

// Project-level assets with diverse classifications, locations, and lifecycle stages
const projectAssets = [
  // Nigeria - Industrial
  { name: "UMZA Oil Mill Solar+BESS", code: "UMZA-001", country: "Nigeria", state: "Lagos", city: "Ikeja", lat: 6.6018, lng: 3.3515, technology: "PV+BESS", capacityMw: 5.2, capacityMwh: 10.4, status: "operational", stage: "operations", classification: "industrial", gridConnection: "grid_tied", config: "solar_bess", topology: "radial", offtaker: "UMZA Industries Ltd", offtakerType: "industrial", contract: "ppa", valueUsd: 8500000, tariff: 0.12 },
  { name: "Dangote Cement Ibese Solar", code: "DCI-001", country: "Nigeria", state: "Ogun", city: "Ibese", lat: 6.9167, lng: 3.0167, technology: "PV", capacityMw: 12.5, status: "construction", stage: "construction", classification: "industrial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Dangote Cement Plc", offtakerType: "industrial", contract: "ppa", valueUsd: 15000000, tariff: 0.11 },
  { name: "Nigerian Breweries Aba Solar", code: "NBA-001", country: "Nigeria", state: "Abia", city: "Aba", lat: 5.1167, lng: 7.3667, technology: "PV+BESS", capacityMw: 3.8, capacityMwh: 7.6, status: "operational", stage: "operations", classification: "industrial", gridConnection: "islandable", config: "solar_bess", topology: "radial", offtaker: "Nigerian Breweries Plc", offtakerType: "industrial", contract: "ppa", valueUsd: 6200000, tariff: 0.13 },
  { name: "Heineken Agbara Biomass Boiler", code: "HAB-001", country: "Nigeria", state: "Ogun", city: "Agbara", lat: 6.5167, lng: 3.1000, technology: "C&I", capacityMw: 2.0, status: "operational", stage: "operations", classification: "industrial", gridConnection: "grid_tied", config: "hybrid", topology: "radial", offtaker: "Heineken Nigeria", offtakerType: "industrial", contract: "esco", valueUsd: 4500000, tariff: 0.10 },
  
  // Nigeria - Large Commercial
  { name: "Shoprite Ikeja City Mall Solar", code: "SIM-001", country: "Nigeria", state: "Lagos", city: "Ikeja", lat: 6.6100, lng: 3.3450, technology: "PV", capacityMw: 1.2, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Shoprite Holdings", offtakerType: "commercial", contract: "ppa", valueUsd: 1800000, tariff: 0.14 },
  { name: "Palms Shopping Mall Lekki", code: "PSM-001", country: "Nigeria", state: "Lagos", city: "Lekki", lat: 6.4281, lng: 3.4219, technology: "PV+BESS", capacityMw: 0.8, capacityMwh: 1.6, status: "development", stage: "due_diligence", classification: "large_commercial", gridConnection: "islandable", config: "solar_bess", topology: "radial", offtaker: "Persianas Group", offtakerType: "commercial", contract: "ppa", valueUsd: 1500000, tariff: 0.15 },
  { name: "Jabi Lake Mall Abuja Solar", code: "JLM-001", country: "Nigeria", state: "FCT", city: "Abuja", lat: 9.0765, lng: 7.4189, technology: "PV", capacityMw: 0.6, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Actis", offtakerType: "commercial", contract: "ppa", valueUsd: 950000, tariff: 0.13 },
  
  // Nigeria - Mini-Grids
  { name: "Gbamu Gbamu Mini-Grid", code: "GBG-001", country: "Nigeria", state: "Ogun", city: "Gbamu Gbamu", lat: 6.8500, lng: 3.9500, technology: "Minigrid", capacityMw: 0.15, capacityMwh: 0.45, status: "operational", stage: "operations", classification: "mini_grid", gridConnection: "islanded", config: "solar_bess_genset", topology: "radial", offtaker: "Gbamu Gbamu Community", offtakerType: "community", contract: "direct_sale", valueUsd: 450000, tariff: 0.35 },
  { name: "Rokota Mini-Grid", code: "ROK-001", country: "Nigeria", state: "Niger", city: "Rokota", lat: 9.6167, lng: 6.5500, technology: "Minigrid", capacityMw: 0.10, capacityMwh: 0.30, status: "operational", stage: "operations", classification: "mini_grid", gridConnection: "islanded", config: "solar_bess", topology: "radial", offtaker: "Rokota Community", offtakerType: "community", contract: "direct_sale", valueUsd: 320000, tariff: 0.38 },
  { name: "Tunga Maje Mini-Grid", code: "TMG-001", country: "Nigeria", state: "FCT", city: "Tunga Maje", lat: 9.1500, lng: 7.2000, technology: "Minigrid", capacityMw: 0.20, capacityMwh: 0.60, status: "construction", stage: "construction", classification: "mini_grid", gridConnection: "islanded", config: "solar_bess_genset", topology: "radial", offtaker: "Tunga Maje Community", offtakerType: "community", contract: "direct_sale", valueUsd: 580000, tariff: 0.32 },
  { name: "Sabon Gari Mini-Grid", code: "SGM-001", country: "Nigeria", state: "Kaduna", city: "Sabon Gari", lat: 10.5167, lng: 7.4333, technology: "Minigrid", capacityMw: 0.25, capacityMwh: 0.75, status: "development", stage: "development", classification: "mini_grid", gridConnection: "weak_grid", config: "solar_bess_genset", topology: "radial", offtaker: "Sabon Gari Community", offtakerType: "community", contract: "direct_sale", valueUsd: 720000, tariff: 0.30 },
  
  // Côte d'Ivoire
  { name: "OFI San Pedro 3MWp Rooftop", code: "OFI-001", country: "Côte d'Ivoire", state: "Bas-Sassandra", city: "San Pedro", lat: 4.7500, lng: -6.6333, technology: "PV", capacityMw: 3.0, status: "operational", stage: "operations", classification: "industrial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Olam Food Ingredients", offtakerType: "industrial", contract: "ppa", valueUsd: 4200000, tariff: 0.11 },
  { name: "Cargill Abidjan Cocoa Processing", code: "CAC-001", country: "Côte d'Ivoire", state: "Abidjan", city: "Abidjan", lat: 5.3167, lng: -4.0333, technology: "PV+BESS", capacityMw: 2.5, capacityMwh: 5.0, status: "development", stage: "due_diligence", classification: "industrial", gridConnection: "islandable", config: "solar_bess", topology: "radial", offtaker: "Cargill West Africa", offtakerType: "industrial", contract: "ppa", valueUsd: 4800000, tariff: 0.12 },
  { name: "Playce Marcory Mall Solar", code: "PMM-001", country: "Côte d'Ivoire", state: "Abidjan", city: "Marcory", lat: 5.3000, lng: -3.9833, technology: "PV", capacityMw: 0.5, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "CFAO Retail", offtakerType: "commercial", contract: "ppa", valueUsd: 750000, tariff: 0.13 },
  
  // Ghana
  { name: "Accra Mall Rooftop Solar", code: "AMS-001", country: "Ghana", state: "Greater Accra", city: "Accra", lat: 5.6037, lng: -0.1870, technology: "PV", capacityMw: 0.8, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Atterbury Ghana", offtakerType: "commercial", contract: "ppa", valueUsd: 1200000, tariff: 0.14 },
  { name: "Tema Industrial Zone Solar", code: "TIZ-001", country: "Ghana", state: "Greater Accra", city: "Tema", lat: 5.6698, lng: -0.0166, technology: "PV+BESS", capacityMw: 8.0, capacityMwh: 16.0, status: "construction", stage: "construction", classification: "industrial", gridConnection: "grid_tied", config: "solar_bess", topology: "radial", offtaker: "Tema Free Zone", offtakerType: "industrial", contract: "ppa", valueUsd: 12500000, tariff: 0.10 },
  { name: "Kasoa Market Mini-Grid", code: "KMM-001", country: "Ghana", state: "Central", city: "Kasoa", lat: 5.5333, lng: -0.4167, technology: "Minigrid", capacityMw: 0.30, capacityMwh: 0.90, status: "operational", stage: "operations", classification: "mini_grid", gridConnection: "weak_grid", config: "solar_bess_genset", topology: "mesh", offtaker: "Kasoa Market Association", offtakerType: "community", contract: "direct_sale", valueUsd: 850000, tariff: 0.28 },
  
  // Kenya
  { name: "Two Rivers Mall Nairobi Solar", code: "TRM-001", country: "Kenya", state: "Nairobi", city: "Nairobi", lat: -1.2167, lng: 36.8000, technology: "PV", capacityMw: 1.5, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Centum Real Estate", offtakerType: "commercial", contract: "ppa", valueUsd: 2100000, tariff: 0.12 },
  { name: "Strathmore University Solar", code: "SUS-001", country: "Kenya", state: "Nairobi", city: "Nairobi", lat: -1.3100, lng: 36.8100, technology: "PV+BESS", capacityMw: 0.6, capacityMwh: 1.2, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "islandable", config: "solar_bess", topology: "radial", offtaker: "Strathmore University", offtakerType: "commercial", contract: "ppa", valueUsd: 1100000, tariff: 0.11 },
  { name: "Mombasa Cement Solar", code: "MCS-001", country: "Kenya", state: "Coast", city: "Mombasa", lat: -4.0435, lng: 39.6682, technology: "PV", capacityMw: 6.0, status: "development", stage: "feasibility", classification: "industrial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Bamburi Cement", offtakerType: "industrial", contract: "ppa", valueUsd: 7800000, tariff: 0.10 },
  { name: "Lake Turkana Wind Farm Extension", code: "LTW-001", country: "Kenya", state: "Marsabit", city: "Loiyangalani", lat: 2.7500, lng: 36.7167, technology: "Wind", capacityMw: 50.0, status: "prospecting", stage: "origination", classification: "grid_connected", gridConnection: "grid_tied", config: "hybrid", topology: "radial", offtaker: "Kenya Power", offtakerType: "utility", contract: "ppa", valueUsd: 85000000, tariff: 0.08 },
  
  // Tanzania
  { name: "Dar es Salaam Port Solar", code: "DPS-001", country: "Tanzania", state: "Dar es Salaam", city: "Dar es Salaam", lat: -6.8235, lng: 39.2695, technology: "PV+BESS", capacityMw: 4.0, capacityMwh: 8.0, status: "development", stage: "development", classification: "industrial", gridConnection: "islandable", config: "solar_bess", topology: "radial", offtaker: "Tanzania Ports Authority", offtakerType: "industrial", contract: "ppa", valueUsd: 6500000, tariff: 0.11 },
  { name: "Arusha Coffee Processing Solar", code: "ACP-001", country: "Tanzania", state: "Arusha", city: "Arusha", lat: -3.3869, lng: 36.6830, technology: "PV", capacityMw: 1.8, status: "operational", stage: "operations", classification: "industrial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "Taylor Winch Tanzania", offtakerType: "industrial", contract: "ppa", valueUsd: 2400000, tariff: 0.12 },
  { name: "Zanzibar Resort Mini-Grid", code: "ZRM-001", country: "Tanzania", state: "Zanzibar", city: "Stone Town", lat: -6.1622, lng: 39.1921, technology: "Minigrid", capacityMw: 0.50, capacityMwh: 1.50, status: "construction", stage: "commissioning", classification: "mini_grid", gridConnection: "islanded", config: "solar_bess_genset", topology: "radial", offtaker: "Zanzibar Tourism Board", offtakerType: "commercial", contract: "esco", valueUsd: 1200000, tariff: 0.25 },
  
  // South Africa
  { name: "Johannesburg Data Center Solar", code: "JDC-001", country: "South Africa", state: "Gauteng", city: "Johannesburg", lat: -26.2041, lng: 28.0473, technology: "PV+BESS", capacityMw: 15.0, capacityMwh: 60.0, status: "operational", stage: "operations", classification: "industrial", gridConnection: "islandable", config: "solar_bess", topology: "ring", offtaker: "Teraco Data Environments", offtakerType: "industrial", contract: "ppa", valueUsd: 28000000, tariff: 0.09 },
  { name: "Cape Town V&A Waterfront Solar", code: "CVW-001", country: "South Africa", state: "Western Cape", city: "Cape Town", lat: -33.9036, lng: 18.4207, technology: "PV", capacityMw: 2.0, status: "operational", stage: "operations", classification: "large_commercial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "V&A Waterfront Holdings", offtakerType: "commercial", contract: "ppa", valueUsd: 2800000, tariff: 0.11 },
  { name: "Durban Port Industrial Solar", code: "DPI-001", country: "South Africa", state: "KwaZulu-Natal", city: "Durban", lat: -29.8587, lng: 31.0218, technology: "PV+BESS", capacityMw: 10.0, capacityMwh: 20.0, status: "development", stage: "ntp", classification: "industrial", gridConnection: "grid_tied", config: "solar_bess", topology: "radial", offtaker: "Transnet Port Terminals", offtakerType: "industrial", contract: "ppa", valueUsd: 16000000, tariff: 0.10 },
  
  // Senegal
  { name: "Dakar Industrial Zone Solar", code: "DIZ-001", country: "Senegal", state: "Dakar", city: "Dakar", lat: 14.7167, lng: -17.4677, technology: "PV", capacityMw: 5.0, status: "operational", stage: "operations", classification: "industrial", gridConnection: "grid_tied", config: "solar_only", topology: "radial", offtaker: "SOCOCIM Industries", offtakerType: "industrial", contract: "ppa", valueUsd: 6500000, tariff: 0.11 },
  { name: "Saint-Louis Fishing Port Solar", code: "SLF-001", country: "Senegal", state: "Saint-Louis", city: "Saint-Louis", lat: 16.0333, lng: -16.5000, technology: "PV+BESS", capacityMw: 0.8, capacityMwh: 2.4, status: "construction", stage: "construction", classification: "small_commercial", gridConnection: "weak_grid", config: "solar_bess", topology: "radial", offtaker: "Saint-Louis Fish Market", offtakerType: "commercial", contract: "direct_sale", valueUsd: 1400000, tariff: 0.18 },
];

async function seedProjectAssets() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('Starting project-level asset seeding...');
    
    // First, ensure we have a portfolio
    const [portfolios] = await connection.execute('SELECT id FROM portfolios LIMIT 1');
    let portfolioId;
    
    if (portfolios.length === 0) {
      const [result] = await connection.execute(
        'INSERT INTO portfolios (name, description, region) VALUES (?, ?, ?)',
        ['Africa Energy Portfolio', 'Diversified renewable energy portfolio across Sub-Saharan Africa', 'Sub-Saharan Africa']
      );
      portfolioId = result.insertId;
      console.log(`Created portfolio with ID: ${portfolioId}`);
    } else {
      portfolioId = portfolios[0].id;
      console.log(`Using existing portfolio ID: ${portfolioId}`);
    }
    
    // Insert project-level assets
    let inserted = 0;
    for (const asset of projectAssets) {
      try {
        await connection.execute(
          `INSERT INTO projects (
            portfolioId, name, code, country, state, city, 
            latitude, longitude, technology, capacityMw, capacityMwh,
            status, stage, assetClassification, gridConnectionType, 
            configurationProfile, networkTopology, offtakerName, offtakerType,
            contractType, projectValueUsd, tariffUsdKwh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            portfolioId, asset.name, asset.code, asset.country, asset.state, asset.city,
            asset.lat, asset.lng, asset.technology, asset.capacityMw, asset.capacityMwh || null,
            asset.status, asset.stage, asset.classification, asset.gridConnection,
            asset.config, asset.topology, asset.offtaker, asset.offtakerType,
            asset.contract, asset.valueUsd, asset.tariff
          ]
        );
        inserted++;
        console.log(`✓ Inserted: ${asset.name} (${asset.country})`);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⊘ Skipped (duplicate): ${asset.name}`);
        } else {
          console.error(`✗ Failed: ${asset.name}`, err.message);
        }
      }
    }
    
    console.log(`\n✅ Seeding complete: ${inserted} project-level assets inserted`);
    
    // Show summary by classification
    const [summary] = await connection.execute(`
      SELECT assetClassification, COUNT(*) as count 
      FROM projects 
      WHERE assetClassification IS NOT NULL 
      GROUP BY assetClassification
    `);
    console.log('\nAsset Classification Summary:');
    summary.forEach(row => {
      console.log(`  ${row.assetClassification}: ${row.count}`);
    });
    
    // Show summary by country
    const [countrySummary] = await connection.execute(`
      SELECT country, COUNT(*) as count 
      FROM projects 
      WHERE country IS NOT NULL 
      GROUP BY country
    `);
    console.log('\nCountry Distribution:');
    countrySummary.forEach(row => {
      console.log(`  ${row.country}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedProjectAssets().catch(console.error);
