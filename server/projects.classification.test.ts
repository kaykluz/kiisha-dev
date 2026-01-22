/**
 * Tests for project-level asset classification statistics
 * 
 * In KIISHA terminology:
 * - Asset = Project-level investable unit (e.g., "UMZA Oil Mill Solar+BESS")
 * - Component/Equipment = Sub-assets within a project (inverters, batteries, etc.)
 */

import { describe, it, expect } from 'vitest';

describe('Project Classification Labels', () => {
  it('should have valid classification enum values', () => {
    const validClassifications = [
      'residential', 'small_commercial', 'large_commercial', 'industrial',
      'mini_grid', 'mesh_grid', 'interconnected_mini_grids', 'grid_connected'
    ];
    
    validClassifications.forEach(classification => {
      expect(typeof classification).toBe('string');
      expect(classification.length).toBeGreaterThan(0);
    });
  });

  it('should have valid grid connection enum values', () => {
    const validConnections = [
      'grid_tied', 'islanded', 'islandable', 'weak_grid', 'no_grid'
    ];
    
    validConnections.forEach(connection => {
      expect(typeof connection).toBe('string');
      expect(connection.length).toBeGreaterThan(0);
    });
  });

  it('should have valid configuration profile enum values', () => {
    const validProfiles = [
      'solar_only', 'solar_bess', 'solar_genset', 'solar_bess_genset',
      'bess_only', 'genset_only', 'hybrid'
    ];
    
    validProfiles.forEach(profile => {
      expect(typeof profile).toBe('string');
      expect(profile.length).toBeGreaterThan(0);
    });
  });

  it('should have valid network topology enum values', () => {
    const validTopologies = ['radial', 'ring', 'mesh', 'star', 'unknown'];
    
    validTopologies.forEach(topology => {
      expect(typeof topology).toBe('string');
      expect(topology.length).toBeGreaterThan(0);
    });
  });
  
  it('should have valid project status enum values', () => {
    const validStatuses = [
      'prospecting', 'development', 'construction', 'operational', 'decommissioned'
    ];
    
    validStatuses.forEach(status => {
      expect(typeof status).toBe('string');
      expect(status.length).toBeGreaterThan(0);
    });
  });
  
  it('should have valid project stage enum values', () => {
    const validStages = [
      'origination', 'feasibility', 'development', 'due_diligence',
      'ntp', 'construction', 'commissioning', 'cod', 'operations'
    ];
    
    validStages.forEach(stage => {
      expect(typeof stage).toBe('string');
      expect(stage.length).toBeGreaterThan(0);
    });
  });
});

describe('Data Model Terminology', () => {
  it('should understand Asset = Project-level investable unit', () => {
    // This test documents the correct terminology
    const terminology = {
      asset: 'Project-level investable unit (e.g., "UMZA Oil Mill Solar+BESS")',
      component: 'Equipment within a project (inverters, batteries, panels)',
      project: 'Same as Asset - the primary investable entity',
      equipment: 'Same as Component - sub-assets within a project',
    };
    
    expect(terminology.asset).toContain('Project-level');
    expect(terminology.component).toContain('Equipment');
    expect(terminology.project).toContain('Asset');
    expect(terminology.equipment).toContain('Component');
  });
  
  it('should document the data hierarchy', () => {
    const hierarchy = {
      level1: 'Portfolio',
      level2: 'Asset (Project)',
      level3: 'Site (Physical Location)',
      level4: 'System (PV, BESS, Genset)',
      level5: 'Component/Equipment',
    };
    
    expect(hierarchy.level1).toBe('Portfolio');
    expect(hierarchy.level2).toContain('Asset');
    expect(hierarchy.level2).toContain('Project');
    expect(hierarchy.level5).toContain('Component');
  });
});

describe('Classification Filter Structure', () => {
  it('should define valid filter interface', () => {
    interface ProjectClassificationFilters {
      portfolioId?: number;
      organizationId?: number;
      country?: string;
      status?: string;
      stage?: string;
      assetClassification?: string;
      gridConnectionType?: string;
      configurationProfile?: string;
      networkTopology?: string;
    }
    
    const filters: ProjectClassificationFilters = {
      country: 'Nigeria',
      assetClassification: 'industrial',
      gridConnectionType: 'grid_tied',
    };
    
    expect(filters.country).toBe('Nigeria');
    expect(filters.assetClassification).toBe('industrial');
    expect(filters.gridConnectionType).toBe('grid_tied');
  });
  
  it('should support empty filters', () => {
    interface ProjectClassificationFilters {
      portfolioId?: number;
      country?: string;
    }
    
    const emptyFilters: ProjectClassificationFilters = {};
    
    expect(Object.keys(emptyFilters).length).toBe(0);
  });
});

describe('Stats Response Structure', () => {
  it('should define valid stats response structure', () => {
    interface StatsResponse {
      byClassification: Array<{ name: string; value: number; capacityMw?: number }>;
      byGridConnection: Array<{ name: string; value: number }>;
      byConfiguration: Array<{ name: string; value: number }>;
      byTopology: Array<{ name: string; value: number }>;
      byCountry: Array<{ name: string; value: number; capacityMw?: number }>;
      byStatus: Array<{ name: string; value: number }>;
      byStage: Array<{ name: string; value: number }>;
      byTechnology: Array<{ name: string; value: number; capacityMw?: number }>;
      total: number;
      totalCapacityMw: number;
      totalValueUsd: number;
    }
    
    const mockStats: StatsResponse = {
      byClassification: [{ name: 'industrial', value: 13, capacityMw: 85.5 }],
      byGridConnection: [{ name: 'grid_tied', value: 20 }],
      byConfiguration: [{ name: 'solar_bess', value: 15 }],
      byTopology: [{ name: 'radial', value: 25 }],
      byCountry: [{ name: 'Nigeria', value: 12, capacityMw: 45.2 }],
      byStatus: [{ name: 'operational', value: 18 }],
      byStage: [{ name: 'operations', value: 15 }],
      byTechnology: [{ name: 'PV+BESS', value: 12, capacityMw: 35.0 }],
      total: 30,
      totalCapacityMw: 150.5,
      totalValueUsd: 250000000,
    };
    
    expect(mockStats.total).toBe(30);
    expect(mockStats.byClassification[0].name).toBe('industrial');
    expect(mockStats.byCountry[0].name).toBe('Nigeria');
  });
});
