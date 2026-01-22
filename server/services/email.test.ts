/**
 * Email Service Tests
 */

import { describe, it, expect } from 'vitest';
import { sendPasswordResetEmail, sendWorkOrderStatusEmail, EmailResult } from './email';

describe('Email Service', () => {
  describe('sendPasswordResetEmail', () => {
    it('should return success structure', async () => {
      // Without RESEND_API_KEY, it should log to console and return success
      const result = await sendPasswordResetEmail({
        to: 'test@example.com',
        resetToken: 'abc123',
        customerName: 'John Doe',
      });

      // Should return a valid result structure
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle missing email gracefully', async () => {
      const result = await sendPasswordResetEmail({
        to: '',
        resetToken: 'abc123',
        customerName: 'John Doe',
      });

      // Empty email should still return a result
      expect(result).toHaveProperty('success');
    });
  });

  describe('sendWorkOrderStatusEmail', () => {
    it('should return success structure', async () => {
      const result = await sendWorkOrderStatusEmail({
        to: 'customer@example.com',
        customerName: 'Jane Smith',
        workOrderId: 'WO-001',
        workOrderTitle: 'Panel Maintenance',
        newStatus: 'in_progress',
        comment: 'Technician assigned',
      });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle all status types', async () => {
      const statuses = ['submitted', 'in_progress', 'completed', 'cancelled'];
      
      for (const status of statuses) {
        const result = await sendWorkOrderStatusEmail({
          to: 'customer@example.com',
          customerName: 'Test User',
          workOrderId: 'WO-002',
          workOrderTitle: 'Test Order',
          newStatus: status,
        });

        expect(result).toHaveProperty('success');
      }
    });
  });
});
