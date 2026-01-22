/**
 * Seed system view templates for common workflows
 * Run with: node scripts/seed-view-templates.mjs
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const systemTemplates = [
  // Due Diligence Templates
  {
    name: 'Due Diligence Review',
    description: 'Standard view for conducting due diligence on potential acquisitions. Shows all assets with pending verification items and missing documents.',
    category: 'due_diligence',
    filterCriteria: JSON.stringify({
      statuses: ['under_review', 'pending_verification'],
    }),
    defaultColumns: JSON.stringify(['name', 'country', 'capacity', 'verificationStatus', 'documentCount', 'rfiCount']),
    sortOrder: 'verificationStatus_asc',
    isSystem: true,
  },
  {
    name: 'Technical Due Diligence',
    description: 'Focus on technical specifications, equipment details, and performance metrics for engineering review.',
    category: 'due_diligence',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'capacity', 'gridConnectionType', 'configurationProfile', 'performanceRatio']),
    sortOrder: 'capacity_desc',
    isSystem: true,
  },
  {
    name: 'Legal Due Diligence',
    description: 'Focus on permits, contracts, and compliance documentation for legal review.',
    category: 'due_diligence',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'country', 'permitStatus', 'contractStatus', 'complianceScore']),
    sortOrder: 'complianceScore_asc',
    isSystem: true,
  },
  
  // Investor Reporting Templates
  {
    name: 'Investor Data Room',
    description: 'Curated view for investor presentations showing key metrics and verified data only.',
    category: 'investor_reporting',
    filterCriteria: JSON.stringify({
      statuses: ['operational', 'construction'],
    }),
    defaultColumns: JSON.stringify(['name', 'country', 'capacity', 'status', 'coe', 'irr']),
    sortOrder: 'capacity_desc',
    isSystem: true,
  },
  {
    name: 'Quarterly Portfolio Report',
    description: 'Standard quarterly reporting view with performance metrics and financial highlights.',
    category: 'investor_reporting',
    filterCriteria: JSON.stringify({
      statuses: ['operational'],
    }),
    defaultColumns: JSON.stringify(['name', 'capacity', 'generation', 'revenue', 'availability', 'performanceRatio']),
    sortOrder: 'revenue_desc',
    isSystem: true,
  },
  
  // Compliance Templates
  {
    name: 'Compliance Audit',
    description: 'View for compliance officers showing permit expiration dates, regulatory requirements, and audit status.',
    category: 'compliance',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'country', 'permitExpiry', 'lastAuditDate', 'complianceScore', 'openIssues']),
    sortOrder: 'permitExpiry_asc',
    isSystem: true,
  },
  {
    name: 'Environmental Compliance',
    description: 'Focus on environmental permits, impact assessments, and sustainability metrics.',
    category: 'compliance',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'country', 'environmentalPermit', 'carbonOffset', 'biodiversityScore']),
    sortOrder: 'environmentalPermit_asc',
    isSystem: true,
  },
  
  // Operations Templates
  {
    name: 'Operations Dashboard',
    description: 'Real-time operational view showing performance, alerts, and maintenance status.',
    category: 'operations',
    filterCriteria: JSON.stringify({
      statuses: ['operational'],
    }),
    defaultColumns: JSON.stringify(['name', 'status', 'availability', 'generation', 'activeAlerts', 'nextMaintenance']),
    sortOrder: 'activeAlerts_desc',
    isSystem: true,
  },
  {
    name: 'Maintenance Planning',
    description: 'View for O&M teams showing scheduled maintenance, work orders, and equipment health.',
    category: 'operations',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'nextMaintenance', 'openWorkOrders', 'equipmentHealth', 'lastInspection']),
    sortOrder: 'nextMaintenance_asc',
    isSystem: true,
  },
  
  // Financial Templates
  {
    name: 'Financial Overview',
    description: 'Portfolio financial summary with revenue, costs, and profitability metrics.',
    category: 'financial',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'capacity', 'revenue', 'opex', 'ebitda', 'irr', 'paybackPeriod']),
    sortOrder: 'ebitda_desc',
    isSystem: true,
  },
  {
    name: 'Budget vs Actual',
    description: 'Compare budgeted vs actual performance for variance analysis.',
    category: 'financial',
    filterCriteria: JSON.stringify({}),
    defaultColumns: JSON.stringify(['name', 'budgetedRevenue', 'actualRevenue', 'variance', 'budgetedOpex', 'actualOpex']),
    sortOrder: 'variance_desc',
    isSystem: true,
  },
];

async function seedTemplates() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  console.log('Seeding system view templates...');
  
  for (const template of systemTemplates) {
    try {
      // Check if template already exists
      const [existing] = await connection.execute(
        'SELECT id FROM viewTemplates WHERE name = ? AND isSystem = 1',
        [template.name]
      );
      
      if (existing.length > 0) {
        console.log(`  Skipping "${template.name}" (already exists)`);
        continue;
      }
      
      await connection.execute(
        `INSERT INTO viewTemplates (name, description, category, filterCriteria, defaultColumns, sortOrder, isSystem, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          template.name,
          template.description,
          template.category,
          template.filterCriteria,
          template.defaultColumns,
          template.sortOrder,
          template.isSystem,
        ]
      );
      
      console.log(`  Created "${template.name}"`);
    } catch (error) {
      console.error(`  Error creating "${template.name}":`, error.message);
    }
  }
  
  await connection.end();
  console.log('Done!');
}

seedTemplates().catch(console.error);
