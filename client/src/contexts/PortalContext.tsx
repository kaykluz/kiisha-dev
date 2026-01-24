/**
 * Portal Context
 * 
 * Provides authentication state and read-only mode for portal pages.
 * Company users have read-only access to customer data.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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

interface PortalContextValue {
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
  // Helper for disabling actions
  canPerformAction: (actionName?: string) => boolean;
  getReadOnlyMessage: () => string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

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

export function PortalProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenPayload | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | 'all' | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    const payload = parseToken(token);
    if (!payload) {
      setIsLoading(false);
      return;
    }

    setTokenData(payload);

    // For company users, get available customers
    if (payload.isCompanyUser) {
      const customers = getStoredCustomers();
      setAvailableCustomers(customers);
      // Default to "all" for company users
      setSelectedCustomerId('all');
    } else if (payload.customerId) {
      // For customer users, set their customer ID
      setSelectedCustomerId(payload.customerId);
    }

    setIsLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('portal_customers');
    setLocation('/portal/login');
  };

  const isAuthenticated = !!tokenData;
  const isCompanyUser = tokenData?.isCompanyUser || false;
  
  // Company users have read-only access
  const isReadOnly = isCompanyUser;

  // Get effective customer ID (null for "all" view)
  const customerId = useMemo(() => {
    if (selectedCustomerId === 'all') return null;
    return selectedCustomerId;
  }, [selectedCustomerId]);

  // Helper to check if user can perform an action
  const canPerformAction = (actionName?: string) => {
    if (isReadOnly) {
      return false;
    }
    return true;
  };

  // Get message explaining why action is blocked
  const getReadOnlyMessage = () => {
    return 'This action is not available. Company users have read-only access to customer data.';
  };

  const value: PortalContextValue = {
    isAuthenticated,
    isLoading,
    isCompanyUser,
    isReadOnly,
    tokenData,
    customerId,
    selectedCustomerId,
    availableCustomers,
    userEmail: tokenData?.email || null,
    userName: tokenData?.name || null,
    setSelectedCustomerId,
    logout,
    canPerformAction,
    getReadOnlyMessage,
  };

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}

/**
 * Hook to get read-only props for buttons/inputs
 */
export function useReadOnly() {
  const { isReadOnly, getReadOnlyMessage } = usePortal();
  
  return {
    isReadOnly,
    // Props to apply to disabled elements
    disabledProps: isReadOnly ? {
      disabled: true,
      title: getReadOnlyMessage(),
      'aria-disabled': true,
    } : {},
    // Class names for styling disabled state
    disabledClassName: isReadOnly ? 'opacity-50 cursor-not-allowed' : '',
    // Show toast when action is blocked
    showBlockedMessage: () => {
      if (isReadOnly) {
        // Using native alert for simplicity, could use toast
        console.warn(getReadOnlyMessage());
        return true;
      }
      return false;
    },
  };
}
