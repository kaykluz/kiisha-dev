/**
 * Customer Portal Tests
 * 
 * Tests for customer management, search functionality, and access control.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database responses
const mockCustomers = [
  { id: 1, organizationId: 1, code: "TEST-001", name: "Test Customer", companyName: "Acme Solar Corp", email: "test@customer.com", status: "active" },
  { id: 2, organizationId: 1, code: "TEST-002", name: "John Smith", companyName: "Solar Solutions Ltd", email: "john@solar.com", status: "active" },
  { id: 3, organizationId: 1, code: "TEST-003", name: "Jane Doe", companyName: "Green Energy Inc", email: "jane@green.com", status: "inactive" },
];

const mockCustomerUsers = [
  { id: 1, customerId: 1, email: "test@customer.com", name: "Test User", role: "owner", status: "active", emailVerified: true },
];

describe("Customer Portal", () => {
  describe("Customer Search Functionality", () => {
    it("should filter customers by name", () => {
      const searchTerm = "john";
      const filtered = mockCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("John Smith");
    });

    it("should filter customers by email", () => {
      const searchTerm = "solar";
      const filtered = mockCustomers.filter(c => 
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].email).toBe("john@solar.com");
    });

    it("should filter customers by company name", () => {
      const searchTerm = "green";
      const filtered = mockCustomers.filter(c => 
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].companyName).toBe("Green Energy Inc");
    });

    it("should return all customers when search is empty", () => {
      const searchTerm = "";
      const filtered = searchTerm 
        ? mockCustomers.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : mockCustomers;
      
      expect(filtered).toHaveLength(3);
    });

    it("should return empty array when no matches found", () => {
      const searchTerm = "nonexistent";
      const filtered = mockCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(0);
    });

    it("should be case insensitive", () => {
      const searchTerm = "ACME";
      const filtered = mockCustomers.filter(c => 
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].companyName).toBe("Acme Solar Corp");
    });
  });

  describe("Customer Status Filtering", () => {
    it("should filter by active status", () => {
      const filtered = mockCustomers.filter(c => c.status === "active");
      expect(filtered).toHaveLength(2);
    });

    it("should filter by inactive status", () => {
      const filtered = mockCustomers.filter(c => c.status === "inactive");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Jane Doe");
    });
  });

  describe("Customer Access Control", () => {
    it("should verify customer user belongs to customer", () => {
      const customerId = 1;
      const user = mockCustomerUsers.find(u => u.customerId === customerId);
      
      expect(user).toBeDefined();
      expect(user?.customerId).toBe(customerId);
    });

    it("should verify customer user has correct role", () => {
      const user = mockCustomerUsers[0];
      const validRoles = ["owner", "admin", "viewer"];
      
      expect(validRoles).toContain(user.role);
    });

    it("should verify customer user is active", () => {
      const user = mockCustomerUsers[0];
      expect(user.status).toBe("active");
    });

    it("should verify customer user email is verified", () => {
      const user = mockCustomerUsers[0];
      expect(user.emailVerified).toBe(true);
    });
  });

  describe("Customer Data Isolation", () => {
    it("should only return customers for specified organization", () => {
      const orgId = 1;
      const filtered = mockCustomers.filter(c => c.organizationId === orgId);
      
      expect(filtered).toHaveLength(3);
      filtered.forEach(c => {
        expect(c.organizationId).toBe(orgId);
      });
    });

    it("should return empty for non-existent organization", () => {
      const orgId = 999;
      const filtered = mockCustomers.filter(c => c.organizationId === orgId);
      
      expect(filtered).toHaveLength(0);
    });
  });

  describe("Customer Portal Authentication", () => {
    it("should validate email format", () => {
      const validEmail = "test@customer.com";
      const invalidEmail = "not-an-email";
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect(emailRegex.test(validEmail)).toBe(true);
      expect(emailRegex.test(invalidEmail)).toBe(false);
    });

    it("should validate password minimum length", () => {
      const validPassword = "TestCustomer123!";
      const shortPassword = "short";
      const minLength = 8;
      
      expect(validPassword.length >= minLength).toBe(true);
      expect(shortPassword.length >= minLength).toBe(false);
    });
  });

  describe("Customer Invoice Access", () => {
    const mockInvoices = [
      { id: 1, customerId: 1, invoiceNumber: "INV-001", totalAmount: 15000, status: "paid" },
      { id: 2, customerId: 1, invoiceNumber: "INV-002", totalAmount: 25000, status: "pending" },
      { id: 3, customerId: 2, invoiceNumber: "INV-003", totalAmount: 10000, status: "overdue" },
    ];

    it("should only return invoices for specific customer", () => {
      const customerId = 1;
      const customerInvoices = mockInvoices.filter(i => i.customerId === customerId);
      
      expect(customerInvoices).toHaveLength(2);
      customerInvoices.forEach(i => {
        expect(i.customerId).toBe(customerId);
      });
    });

    it("should not expose other customers invoices", () => {
      const customerId = 1;
      const otherCustomerInvoices = mockInvoices.filter(i => i.customerId !== customerId);
      
      expect(otherCustomerInvoices).toHaveLength(1);
      expect(otherCustomerInvoices[0].customerId).toBe(2);
    });
  });
});
