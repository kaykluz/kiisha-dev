import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('Portfolio Views - View Scoping', () => {
  let viewAId: number | null = null;
  let viewBId: number | null = null;

  beforeAll(async () => {
    // Get existing test views created by seed script
    const views = await db.getPortfolioViews();
    const viewA = views.find(v => v.name.includes('View A'));
    const viewB = views.find(v => v.name.includes('View B'));
    viewAId = viewA?.id || null;
    viewBId = viewB?.id || null;
  });

  describe('getPortfolioViews', () => {
    it('should return all portfolio views', async () => {
      const views = await db.getPortfolioViews();
      expect(Array.isArray(views)).toBe(true);
      expect(views.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPortfolioView', () => {
    it('should return a specific view by ID', async () => {
      if (!viewAId) {
        console.log('Skipping: View A not found');
        return;
      }
      
      const view = await db.getPortfolioView(viewAId);
      expect(view).toBeDefined();
      expect(view?.name).toContain('View A');
      expect(view?.viewType).toBe('static');
    });

    it('should return undefined for non-existent view', async () => {
      const view = await db.getPortfolioView(999999);
      expect(view).toBeUndefined();
    });
  });

  describe('getAssetsForView - Static View', () => {
    it('should return exactly 5 assets for View A (static)', async () => {
      if (!viewAId) {
        console.log('Skipping: View A not found');
        return;
      }
      
      const assets = await db.getAssetsForView(viewAId);
      expect(Array.isArray(assets)).toBe(true);
      expect(assets.length).toBe(5);
      
      // All should be Nigerian assets
      for (const asset of assets) {
        expect(asset.country).toBe('Nigeria');
      }
    });
  });

  describe('getAssetsForView - Dynamic View', () => {
    it('should return ~10 assets for View B (dynamic filter)', async () => {
      if (!viewBId) {
        console.log('Skipping: View B not found');
        return;
      }
      
      const assets = await db.getAssetsForView(viewBId);
      expect(Array.isArray(assets)).toBe(true);
      expect(assets.length).toBeGreaterThanOrEqual(10);
      
      // All should be from Kenya, Ghana, or Tanzania
      const validCountries = ['Kenya', 'Ghana', 'Tanzania'];
      for (const asset of assets) {
        expect(validCountries).toContain(asset.country);
      }
    });
  });

  describe('getViewClassificationStats', () => {
    it('should return classification stats scoped to View A', async () => {
      if (!viewAId) {
        console.log('Skipping: View A not found');
        return;
      }
      
      const stats = await db.getViewClassificationStats(viewAId);
      expect(stats).toBeDefined();
      expect(stats.total).toBe(5);
      expect(stats.byClassification).toBeDefined();
      expect(Array.isArray(stats.byClassification)).toBe(true);
    });

    it('should return different stats for View B vs View A', async () => {
      if (!viewAId || !viewBId) {
        console.log('Skipping: Views not found');
        return;
      }
      
      const statsA = await db.getViewClassificationStats(viewAId);
      const statsB = await db.getViewClassificationStats(viewBId);
      
      // View A has 5 assets, View B has ~10
      expect(statsA.total).toBe(5);
      expect(statsB.total).toBeGreaterThanOrEqual(10);
      
      // They should have different totals
      expect(statsA.total).not.toBe(statsB.total);
    });

    it('should support additional filters on top of view scope', async () => {
      if (!viewBId) {
        console.log('Skipping: View B not found');
        return;
      }
      
      // Get stats for View B filtered to Kenya only
      const kenyaStats = await db.getViewClassificationStats(viewBId, {
        country: 'Kenya'
      });
      
      // Should be fewer than total View B assets
      const totalStats = await db.getViewClassificationStats(viewBId);
      expect(kenyaStats.total).toBeLessThan(totalStats.total);
      
      // All should be from Kenya
      for (const item of kenyaStats.byCountry) {
        expect(item.name).toBe('Kenya');
      }
    });
  });

  describe('View Scoping Proof', () => {
    it('should prove charts show different data per view', async () => {
      if (!viewAId || !viewBId) {
        console.log('Skipping: Views not found');
        return;
      }
      
      const statsA = await db.getViewClassificationStats(viewAId);
      const statsB = await db.getViewClassificationStats(viewBId);
      
      // Log the proof
      console.log('\n=== VIEW SCOPING PROOF ===');
      console.log(`View A (Nigeria Industrial): ${statsA.total} assets, ${statsA.totalCapacityMw.toFixed(1)} MW`);
      console.log(`View B (East & West Africa): ${statsB.total} assets, ${statsB.totalCapacityMw.toFixed(1)} MW`);
      console.log('\nView A Classifications:', statsA.byClassification.map(c => `${c.name}: ${c.value}`).join(', '));
      console.log('View B Classifications:', statsB.byClassification.map(c => `${c.name}: ${c.value}`).join(', '));
      console.log('=========================\n');
      
      // Assertions
      expect(statsA.total).toBe(5);
      expect(statsB.total).toBeGreaterThanOrEqual(10);
      expect(statsA.byCountry.length).toBe(1); // Only Nigeria
      expect(statsB.byCountry.length).toBe(3); // Kenya, Ghana, Tanzania
    });
  });
});
