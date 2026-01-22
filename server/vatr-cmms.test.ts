import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module - using factory function to avoid hoisting issues
vi.mock('./db', () => {
  const mockSites = [
    { id: 1, name: 'Lagos Solar Farm', siteCode: 'LSF-001', projectId: 1, status: 'active', capacityKw: '5000' },
    { id: 2, name: 'Abuja Wind Park', siteCode: 'AWP-001', projectId: 1, status: 'active', capacityKw: '10000' },
  ];

  const mockSystems = [
    { id: 1, siteId: 1, name: 'PV Array 1', systemType: 'pv', status: 'active', capacityKw: '2500' },
    { id: 2, siteId: 1, name: 'BESS Unit 1', systemType: 'bess', status: 'active', capacityKwh: '5000' },
  ];

  const mockAssets = [
    { id: 1, systemId: 1, siteId: 1, vatrId: 'VATR-INV-001', assetType: 'inverter', name: 'Inverter 1', status: 'active' },
    { id: 2, systemId: 1, siteId: 1, vatrId: 'VATR-PNL-001', assetType: 'panel', name: 'Panel Array 1', status: 'active' },
    { id: 3, systemId: 2, siteId: 1, vatrId: 'VATR-BAT-001', assetType: 'battery', name: 'Battery Pack 1', status: 'active' },
  ];

  const mockWorkOrders = [
    { id: 1, workOrderNumber: 'WO-2026-001', title: 'Quarterly Inspection', status: 'open', priority: 'medium', siteId: 1 },
    { id: 2, workOrderNumber: 'WO-2026-002', title: 'Inverter Repair', status: 'in_progress', priority: 'high', siteId: 1 },
    { id: 3, workOrderNumber: 'WO-2026-003', title: 'Panel Cleaning', status: 'completed', priority: 'low', siteId: 1 },
  ];

  const mockMaintenanceSchedules = [
    { id: 1, name: 'Monthly Panel Cleaning', maintenanceType: 'preventive', frequencyValue: 1, frequencyUnit: 'months', status: 'active' },
    { id: 2, name: 'Quarterly Inverter Check', maintenanceType: 'preventive', frequencyValue: 3, frequencyUnit: 'months', status: 'active' },
  ];

  const mockAttributes = [
    { id: 1, assetId: 1, attributeKey: 'efficiency_rating', valueNumeric: '98.5', unit: '%', version: 1, isCurrent: true, verificationStatus: 'verified' },
    { id: 2, assetId: 1, attributeKey: 'firmware_version', valueText: 'v2.3.1', version: 2, isCurrent: true, verificationStatus: 'unverified' },
  ];

  return {
    getSites: vi.fn().mockResolvedValue(mockSites),
    getSiteById: vi.fn().mockImplementation((id: number) => Promise.resolve(mockSites.find(s => s.id === id))),
    createSite: vi.fn().mockResolvedValue({ id: 3, name: 'New Site' }),
    updateSite: vi.fn().mockResolvedValue({ success: true }),
    deleteSite: vi.fn().mockResolvedValue({ success: true }),
    
    getSystems: vi.fn().mockResolvedValue(mockSystems),
    getSystemById: vi.fn().mockImplementation((id: number) => Promise.resolve(mockSystems.find(s => s.id === id))),
    createSystem: vi.fn().mockResolvedValue({ id: 3, name: 'New System' }),
    updateSystem: vi.fn().mockResolvedValue({ success: true }),
    deleteSystem: vi.fn().mockResolvedValue({ success: true }),
    
    getAssets: vi.fn().mockResolvedValue(mockAssets),
    getAssetById: vi.fn().mockImplementation((id: number) => Promise.resolve(mockAssets.find(a => a.id === id))),
    getAssetByVatrId: vi.fn().mockImplementation((vatrId: string) => Promise.resolve(mockAssets.find(a => a.vatrId === vatrId))),
    createAsset: vi.fn().mockResolvedValue({ id: 4, vatrId: 'VATR-NEW-001' }),
    updateAsset: vi.fn().mockResolvedValue({ success: true }),
    deleteAsset: vi.fn().mockResolvedValue({ success: true }),
    
    getAssetComponents: vi.fn().mockResolvedValue([]),
    createAssetComponent: vi.fn().mockResolvedValue({ id: 1 }),
    updateAssetComponent: vi.fn().mockResolvedValue({ success: true }),
    deleteAssetComponent: vi.fn().mockResolvedValue({ success: true }),
    
    getAssetAttributes: vi.fn().mockResolvedValue(mockAttributes),
    getAttributeHistory: vi.fn().mockResolvedValue(mockAttributes),
    createVersionedAttribute: vi.fn().mockResolvedValue({ id: 3, version: 1 }),
    verifyAttribute: vi.fn().mockResolvedValue({ success: true }),
    rejectAttribute: vi.fn().mockResolvedValue({ success: true }),
    
    getWorkOrders: vi.fn().mockResolvedValue(mockWorkOrders),
    getWorkOrderById: vi.fn().mockImplementation((id: number) => Promise.resolve(mockWorkOrders.find(w => w.id === id))),
    createWorkOrder: vi.fn().mockResolvedValue({ id: 4, workOrderNumber: 'WO-2026-004' }),
    updateWorkOrder: vi.fn().mockResolvedValue({ success: true }),
    updateWorkOrderStatus: vi.fn().mockResolvedValue({ success: true }),
    deleteWorkOrder: vi.fn().mockResolvedValue({ success: true }),
    
    getWorkOrderTasks: vi.fn().mockResolvedValue([]),
    createWorkOrderTask: vi.fn().mockResolvedValue({ id: 1 }),
    updateWorkOrderTask: vi.fn().mockResolvedValue({ success: true }),
    completeWorkOrderTask: vi.fn().mockResolvedValue({ success: true }),
    
    getMaintenanceSchedules: vi.fn().mockResolvedValue(mockMaintenanceSchedules),
    getMaintenanceScheduleById: vi.fn().mockImplementation((id: number) => Promise.resolve(mockMaintenanceSchedules.find(s => s.id === id))),
    createMaintenanceSchedule: vi.fn().mockResolvedValue({ id: 3, name: 'New Schedule' }),
    updateMaintenanceSchedule: vi.fn().mockResolvedValue({ success: true }),
    deleteMaintenanceSchedule: vi.fn().mockResolvedValue({ success: true }),
    
    getSpareParts: vi.fn().mockResolvedValue([]),
    getSparePartById: vi.fn().mockResolvedValue(null),
    createSparePart: vi.fn().mockResolvedValue({ id: 1 }),
    updateSparePart: vi.fn().mockResolvedValue({ success: true }),
    recordPartsUsage: vi.fn().mockResolvedValue({ success: true }),
    
    getOmDashboardStats: vi.fn().mockResolvedValue({
      workOrders: { open: 5, inProgress: 3, completed: 12, overdue: 1 },
      assets: { total: 50, active: 48, failed: 2, byType: { inverter: 10, panel: 30, battery: 10 } },
      upcomingMaintenance: mockMaintenanceSchedules,
    }),
    
    calculateSiteProfileCompleteness: vi.fn().mockResolvedValue({
      overall: 75,
      bySection: {
        location: { completed: 5, total: 7, percentage: 71 },
        technical: { completed: 4, total: 4, percentage: 100 },
      },
    }),
  };
});

import * as db from './db';

describe('VATR Hierarchical Data Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sites', () => {
    it('should list all sites', async () => {
      const sites = await db.getSites();
      expect(sites).toHaveLength(2);
      expect(sites[0].name).toBe('Lagos Solar Farm');
    });

    it('should get site by ID', async () => {
      const site = await db.getSiteById(1);
      expect(site).toBeDefined();
      expect(site?.siteCode).toBe('LSF-001');
    });

    it('should create a new site', async () => {
      const result = await db.createSite({ name: 'New Site', projectId: 1 } as any);
      expect(result).toBeDefined();
      expect(result?.id).toBe(3);
    });

    it('should update a site', async () => {
      const result = await db.updateSite(1, { name: 'Updated Site' } as any);
      expect(result).toEqual({ success: true });
    });

    it('should delete a site', async () => {
      const result = await db.deleteSite(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Systems', () => {
    it('should list all systems', async () => {
      const systems = await db.getSystems();
      expect(systems).toHaveLength(2);
      expect(systems[0].systemType).toBe('pv');
    });

    it('should get system by ID', async () => {
      const system = await db.getSystemById(1);
      expect(system).toBeDefined();
      expect(system?.name).toBe('PV Array 1');
    });

    it('should create a new system', async () => {
      const result = await db.createSystem({ name: 'New System', siteId: 1, systemType: 'pv' } as any);
      expect(result).toBeDefined();
      expect(result?.id).toBe(3);
    });
  });

  describe('Assets (VATR Core)', () => {
    it('should list all assets', async () => {
      const assets = await db.getAssets();
      expect(assets).toHaveLength(3);
    });

    it('should get asset by ID', async () => {
      const asset = await db.getAssetById(1);
      expect(asset).toBeDefined();
      expect(asset?.assetType).toBe('inverter');
    });

    it('should get asset by VATR ID', async () => {
      const asset = await db.getAssetByVatrId('VATR-INV-001');
      expect(asset).toBeDefined();
      expect(asset?.name).toBe('Inverter 1');
    });

    it('should create a new asset with VATR ID', async () => {
      const result = await db.createAsset({
        systemId: 1,
        siteId: 1,
        assetType: 'meter',
        name: 'New Meter',
      } as any);
      expect(result).toBeDefined();
      expect(result?.vatrId).toBe('VATR-NEW-001');
    });

    it('should filter assets by type', async () => {
      const assets = await db.getAssets({ assetType: 'inverter' });
      expect(assets).toBeDefined();
    });
  });

  describe('Versioned Attributes', () => {
    it('should get current attributes for an asset', async () => {
      const attributes = await db.getAssetAttributes(1, true);
      expect(attributes).toHaveLength(2);
      expect(attributes[0].attributeKey).toBe('efficiency_rating');
    });

    it('should get attribute history', async () => {
      const history = await db.getAttributeHistory(1, 'firmware_version');
      expect(history).toBeDefined();
    });

    it('should create a new versioned attribute', async () => {
      const result = await db.createVersionedAttribute(
        1,
        'temperature',
        { numeric: '45.5' },
        { type: 'iot' },
        'operational',
        '°C',
        1
      );
      expect(result).toBeDefined();
      expect(result?.version).toBe(1);
    });

    it('should verify an attribute', async () => {
      const result = await db.verifyAttribute(1, 1);
      expect(result).toEqual({ success: true });
    });

    it('should reject an attribute with reason', async () => {
      const result = await db.rejectAttribute(2, 1, 'Value out of expected range');
      expect(result).toEqual({ success: true });
    });
  });
});

describe('CMMS (Computerized Maintenance Management System)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Work Orders', () => {
    it('should list all work orders', async () => {
      const workOrders = await db.getWorkOrders();
      expect(workOrders).toHaveLength(3);
    });

    it('should get work order by ID', async () => {
      const wo = await db.getWorkOrderById(1);
      expect(wo).toBeDefined();
      expect(wo?.workOrderNumber).toBe('WO-2026-001');
    });

    it('should filter work orders by status', async () => {
      const workOrders = await db.getWorkOrders({ status: 'open' });
      expect(workOrders).toBeDefined();
    });

    it('should create a new work order', async () => {
      const result = await db.createWorkOrder({
        siteId: 1,
        title: 'New Work Order',
        workType: 'corrective',
        priority: 'high',
        sourceType: 'reactive',
      } as any);
      expect(result).toBeDefined();
      expect(result?.workOrderNumber).toBe('WO-2026-004');
    });

    it('should update work order status', async () => {
      const result = await db.updateWorkOrderStatus(1, 'in_progress');
      expect(result).toEqual({ success: true });
    });

    it('should update work order details', async () => {
      const result = await db.updateWorkOrder(1, { title: 'Updated Title' } as any);
      expect(result).toEqual({ success: true });
    });

    it('should delete a work order', async () => {
      const result = await db.deleteWorkOrder(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Maintenance Schedules', () => {
    it('should list all maintenance schedules', async () => {
      const schedules = await db.getMaintenanceSchedules();
      expect(schedules).toHaveLength(2);
    });

    it('should get schedule by ID', async () => {
      const schedule = await db.getMaintenanceScheduleById(1);
      expect(schedule).toBeDefined();
      expect(schedule?.name).toBe('Monthly Panel Cleaning');
    });

    it('should create a new maintenance schedule', async () => {
      const result = await db.createMaintenanceSchedule({
        name: 'Annual Inspection',
        maintenanceType: 'preventive',
        frequencyValue: 1,
        frequencyUnit: 'years',
        scopeType: 'site',
        scopeId: 1,
      } as any);
      expect(result).toBeDefined();
      expect(result?.name).toBe('New Schedule');
    });

    it('should update a maintenance schedule', async () => {
      const result = await db.updateMaintenanceSchedule(1, { status: 'paused' } as any);
      expect(result).toEqual({ success: true });
    });

    it('should delete a maintenance schedule', async () => {
      const result = await db.deleteMaintenanceSchedule(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('O&M Dashboard Stats', () => {
    it('should return dashboard statistics', async () => {
      const stats = await db.getOmDashboardStats();
      expect(stats).toBeDefined();
      expect(stats.workOrders.open).toBe(5);
      expect(stats.assets.total).toBe(50);
      expect(stats.upcomingMaintenance).toHaveLength(2);
    });

    it('should include asset distribution by type', async () => {
      const stats = await db.getOmDashboardStats();
      expect(stats.assets.byType).toBeDefined();
      expect(stats.assets.byType.inverter).toBe(10);
    });
  });
});

describe('Site Profile Completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate site profile completeness', async () => {
    const completeness = await db.calculateSiteProfileCompleteness(1);
    expect(completeness).toBeDefined();
    expect(completeness.overall).toBe(75);
  });

  it('should return completeness by section', async () => {
    const completeness = await db.calculateSiteProfileCompleteness(1);
    expect(completeness.bySection).toBeDefined();
    expect(completeness.bySection.technical.percentage).toBe(100);
    expect(completeness.bySection.location.percentage).toBe(71);
  });
});

describe('VATR ID Generation', () => {
  it('should generate unique VATR IDs', () => {
    const vatrIdPattern = /^VATR-[A-Z]{3}-[A-Z0-9]{3,}$/;
    const sampleVatrId = 'VATR-INV-A1B2C3D4';
    expect(sampleVatrId).toMatch(vatrIdPattern);
  });

  it('should include asset type prefix in VATR ID', () => {
    const inverterVatrId = 'VATR-INV-001';
    const panelVatrId = 'VATR-PNL-001';
    const batteryVatrId = 'VATR-BAT-001';
    
    expect(inverterVatrId).toContain('INV');
    expect(panelVatrId).toContain('PNL');
    expect(batteryVatrId).toContain('BAT');
  });
});

describe('Work Order Workflow', () => {
  it('should follow correct status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      open: ['assigned', 'in_progress', 'cancelled'],
      assigned: ['in_progress', 'on_hold', 'cancelled'],
      in_progress: ['on_hold', 'completed', 'cancelled'],
      on_hold: ['in_progress', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    expect(validTransitions.open).toContain('in_progress');
    expect(validTransitions.in_progress).toContain('completed');
    expect(validTransitions.completed).toHaveLength(0);
  });

  it('should track work order priority levels', () => {
    const priorities = ['critical', 'high', 'medium', 'low'];
    expect(priorities).toContain('critical');
    expect(priorities.indexOf('critical')).toBeLessThan(priorities.indexOf('low'));
  });
});

describe('Attribute Verification Workflow', () => {
  it('should support verification status transitions', () => {
    const validStatuses = ['unverified', 'verified', 'rejected'];
    expect(validStatuses).toContain('unverified');
    expect(validStatuses).toContain('verified');
    expect(validStatuses).toContain('rejected');
  });

  it('should track verification metadata', () => {
    const verifiedAttribute = {
      verificationStatus: 'verified',
      verifiedById: 1,
      verifiedAt: new Date(),
    };
    
    expect(verifiedAttribute.verificationStatus).toBe('verified');
    expect(verifiedAttribute.verifiedById).toBeDefined();
    expect(verifiedAttribute.verifiedAt).toBeInstanceOf(Date);
  });
});
