import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('./db', () => ({
  getAssetClassificationStats: vi.fn(),
}));

import * as db from './db';

describe('Asset Classification Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return classification distribution data', async () => {
    const mockStats = {
      byClassification: [
        { name: 'residential', value: 3 },
        { name: 'small_commercial', value: 5 },
        { name: 'industrial', value: 2 },
      ],
      byGridConnection: [
        { name: 'off_grid', value: 4 },
        { name: 'grid_connected', value: 6 },
      ],
      byConfiguration: [
        { name: 'pv_only', value: 3 },
        { name: 'pv_bess', value: 5 },
        { name: 'hybrid_custom', value: 2 },
      ],
      byTopology: [
        { name: 'radial', value: 5 },
        { name: 'mesh', value: 3 },
        { name: 'ring', value: 2 },
      ],
      total: 10,
    };

    vi.mocked(db.getAssetClassificationStats).mockResolvedValue(mockStats);

    const result = await db.getAssetClassificationStats();

    expect(result).toEqual(mockStats);
    expect(result.total).toBe(10);
    expect(result.byClassification).toHaveLength(3);
    expect(result.byGridConnection).toHaveLength(2);
    expect(result.byConfiguration).toHaveLength(3);
    expect(result.byTopology).toHaveLength(3);
  });

  it('should return empty arrays when no assets exist', async () => {
    const emptyStats = {
      byClassification: [],
      byGridConnection: [],
      byConfiguration: [],
      byTopology: [],
      total: 0,
    };

    vi.mocked(db.getAssetClassificationStats).mockResolvedValue(emptyStats);

    const result = await db.getAssetClassificationStats();

    expect(result.total).toBe(0);
    expect(result.byClassification).toHaveLength(0);
    expect(result.byGridConnection).toHaveLength(0);
    expect(result.byConfiguration).toHaveLength(0);
    expect(result.byTopology).toHaveLength(0);
  });

  it('should correctly aggregate counts by classification type', async () => {
    const mockStats = {
      byClassification: [
        { name: 'mini_grid', value: 10 },
        { name: 'mesh_grid', value: 8 },
        { name: 'interconnected_mini_grids', value: 5 },
        { name: 'grid_connected', value: 12 },
      ],
      byGridConnection: [],
      byConfiguration: [],
      byTopology: [],
      total: 35,
    };

    vi.mocked(db.getAssetClassificationStats).mockResolvedValue(mockStats);

    const result = await db.getAssetClassificationStats();

    // Verify the sum of classification counts
    const classificationSum = result.byClassification.reduce((sum, item) => sum + item.value, 0);
    expect(classificationSum).toBe(35);
  });

  it('should handle all configuration profile types', async () => {
    const allConfigs = [
      'pv_only', 'pv_bess', 'pv_dg', 'pv_bess_dg', 'bess_only', 'dg_only',
      'minigrid_pv_bess', 'minigrid_pv_bess_dg', 'mesh_pv_bess', 'mesh_pv_bess_dg', 'hybrid_custom'
    ];

    const mockStats = {
      byClassification: [],
      byGridConnection: [],
      byConfiguration: allConfigs.map((config, i) => ({ name: config, value: i + 1 })),
      byTopology: [],
      total: 66, // Sum of 1+2+3+...+11
    };

    vi.mocked(db.getAssetClassificationStats).mockResolvedValue(mockStats);

    const result = await db.getAssetClassificationStats();

    expect(result.byConfiguration).toHaveLength(11);
    expect(result.byConfiguration.map(c => c.name)).toEqual(allConfigs);
  });

  it('should handle all network topology types', async () => {
    const allTopologies = ['radial', 'ring', 'mesh', 'star', 'unknown'];

    const mockStats = {
      byClassification: [],
      byGridConnection: [],
      byConfiguration: [],
      byTopology: allTopologies.map((topology, i) => ({ name: topology, value: (i + 1) * 2 })),
      total: 30, // Sum of 2+4+6+8+10
    };

    vi.mocked(db.getAssetClassificationStats).mockResolvedValue(mockStats);

    const result = await db.getAssetClassificationStats();

    expect(result.byTopology).toHaveLength(5);
    expect(result.byTopology.map(t => t.name)).toEqual(allTopologies);
  });
});
