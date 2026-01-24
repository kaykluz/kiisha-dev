/**
 * Portal Authentication Hook
 * 
 * Provides authentication state and company user detection for portal pages.
 * Company users have read-only access to customer data.
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';

interface TokenPayload {
  type: 'customer' | 'company';
  userId: number;
  email: string;
  name?: string;
  customerId?: number;
  isCompanyUser?: boolean;
  isSuperuser?: boolean;
  allowedCustomerIds?: number[];
  allowedOrgIds?: number[];
}

interface CustomerOption {
  id: number;
  name: string;
  companyName: string | null;
  organizationId: number;
}

interface PortalAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isCompanyUser: boolean;
  isReadOnly: boolean;
  tokenData: TokenPayload | null;
  customerId: number | null;
  selectedCustomerId: number | 'all' | null;
  availableCustomers: CustomerOption[];
  userEmail: string | null;
  userName: string | null;
  setSelectedCustomerId: (id: number | 'all') => void;
  logout: () => void;
}

function parseToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

function getStoredCustomers(): CustomerOption[] {
  try {
    const stored = localStorage.getItem('portal_customers');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function usePortalAuth(): PortalAuthState {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenPayload | null>(null);
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<number | 'all' | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setIsLoading(false);
      setLocation('/portal/login');
      return;
    }

    const payload = parseToken(token);
    if (!payload) {
      setIsLoading(false);
      setLocation('/portal/login');
      return;
    }

    setTokenData(payload);

    // For company users, get available customers
    if (payload.isCompanyUser) {
      const customers = getStoredCustomers();
      setAvailableCustomers(customers);
      // Check for stored selection
      const storedSelection = localStorage.getItem('portal_selected_customer');
      if (storedSelection && storedSelection !== 'all') {
        setSelectedCustomerIdState(parseInt(storedSelection, 10));
      } else {
        setSelectedCustomerIdState('all');
      }
    } else if (payload.customerId) {
      // For customer users, set their customer ID
      setSelectedCustomerIdState(payload.customerId);
    } else {
      // No valid customer ID and not a company user
      setIsLoading(false);
      setLocation('/portal/login');
      return;
    }

    setIsLoading(false);
  }, [setLocation]);

  const logout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('portal_customers');
    localStorage.removeItem('portal_selected_customer');
    setLocation('/portal/login');
  };
  
  const setSelectedCustomerId = (id: number | 'all') => {
    setSelectedCustomerIdState(id);
    localStorage.setItem('portal_selected_customer', id === 'all' ? 'all' : id.toString());
  };

  const isAuthenticated = !!tokenData;
  const isCompanyUser = tokenData?.isCompanyUser || false;
  
  // Company users have read-only access
  const isReadOnly = isCompanyUser;

  // Get effective customer ID (0 for "all" view to indicate consolidated)
  const customerId = useMemo(() => {
    if (selectedCustomerIdState === 'all') return 0;
    return selectedCustomerIdState;
  }, [selectedCustomerIdState]);

  return {
    isAuthenticated,
    isLoading,
    isCompanyUser,
    isReadOnly,
    tokenData,
    customerId,
    selectedCustomerId: selectedCustomerIdState,
    availableCustomers,
    userEmail: tokenData?.email || null,
    userName: tokenData?.name || null,
    setSelectedCustomerId,
    logout,
  };
}

/**
 * Helper to check if an action should be disabled for company users
 */
export function useReadOnlyCheck() {
  const { isReadOnly } = usePortalAuth();
  
  return {
    isReadOnly,
    // Returns props to disable a button/input for read-only users
    getReadOnlyProps: () => isReadOnly ? {
      disabled: true,
      title: 'Read-only access - Company users cannot modify customer data',
      className: 'opacity-50 cursor-not-allowed',
    } : {},
    // Shows a tooltip/message if action is blocked
    showReadOnlyMessage: () => {
      if (isReadOnly) {
        alert('This action is not available in read-only mode. Company users can only view customer data.');
        return true;
      }
      return false;
    },
  };
}
