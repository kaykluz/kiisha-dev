/**
 * Customer Portal Layout
 * 
 * Shared layout component for all portal pages.
 * Includes read-only mode support for company users.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, LogOut, User, LayoutDashboard, FileText, CreditCard, FolderOpen, Files, Eye, Building2, Users, Clipboard } from 'lucide-react';

interface PortalLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

interface TokenPayload {
  type: 'customer' | 'company';
  userId: number;
  email: string;
  name?: string;
  customerId?: number;
  isCompanyUser?: boolean;
}

interface CustomerOption {
  id: number;
  name: string;
  companyName: string | null;
  organizationId: number;
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

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/portal/dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', href: '/portal/invoices', icon: FileText },
  { id: 'work-orders', label: 'Work Orders', href: '/portal/work-orders', icon: Clipboard },
  { id: 'payments', label: 'Payments', href: '/portal/payments', icon: CreditCard },
  { id: 'projects', label: 'Projects', href: '/portal/projects', icon: FolderOpen },
  { id: 'documents', label: 'Documents', href: '/portal/documents', icon: Files },
];

export default function PortalLayout({ children, activeTab }: PortalLayoutProps) {
  const [, setLocation] = useLocation();
  const [tokenData, setTokenData] = useState<TokenPayload | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  
  // Check authentication and parse token
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setLocation('/portal/login');
      return;
    }
    
    const payload = parseToken(token);
    if (!payload) {
      setLocation('/portal/login');
      return;
    }
    
    setTokenData(payload);
    
    // For company users, get available customers
    if (payload.isCompanyUser) {
      const customers = getStoredCustomers();
      setAvailableCustomers(customers);
    }
  }, [setLocation]);
  
  const isCompanyUser = tokenData?.isCompanyUser || false;
  
  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('portal_customers');
    localStorage.removeItem('portal_selected_customer');
    setLocation('/portal/login');
  };
  
  const handleCustomerChange = (value: string) => {
    setSelectedCustomerId(value);
    // Store in localStorage so other pages can access it
    localStorage.setItem('portal_selected_customer', value);
    // Refresh the page to reload data with new customer
    window.location.reload();
  };
  
  // Load selected customer from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('portal_selected_customer');
    if (stored) {
      setSelectedCustomerId(stored);
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setLocation('/portal/dashboard')}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {isCompanyUser ? 'Company Portal' : 'Customer Portal'}
                </h1>
                <p className="text-sm text-slate-400">
                  {isCompanyUser ? (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Read-only view
                    </span>
                  ) : (
                    'KIISHA'
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Customer Selector for Company Users */}
              {isCompanyUser && availableCustomers.length > 0 && (
                <Select value={selectedCustomerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger className="w-[250px] bg-slate-700 border-slate-600 text-white">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <SelectValue placeholder="Select customer" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-white hover:bg-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        All Customers ({availableCustomers.length})
                      </div>
                    </SelectItem>
                    {availableCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()} className="text-white hover:bg-slate-700">
                        {c.companyName || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <User className="w-4 h-4 mr-2" />
                {tokenData?.email || 'Profile'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-white"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Company User Read-Only Banner */}
      {isCompanyUser && (
        <div className="bg-blue-900/30 border-b border-blue-800/50">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-2 text-blue-300 text-sm">
              <Eye className="w-4 h-4" />
              <span>You are viewing as a company user. This is a read-only view - you cannot modify customer data.</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="bg-slate-800/50 border-b border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setLocation(item.href)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive 
                      ? 'text-orange-400 border-b-2 border-orange-400' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-slate-500">
            Powered by KIISHA • {isCompanyUser ? 'Company Portal (Read-Only)' : 'Customer Portal'}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Helper hook to check if current user is in read-only mode
 */
export function usePortalReadOnly(): { isReadOnly: boolean; isCompanyUser: boolean } {
  const [isCompanyUser, setIsCompanyUser] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setIsCompanyUser(payload.isCompanyUser || false);
      } catch {
        setIsCompanyUser(false);
      }
    }
  }, []);
  
  return {
    isReadOnly: isCompanyUser,
    isCompanyUser,
  };
}

/**
 * Helper to get the currently selected customer ID
 */
export function getSelectedCustomerId(): number | 'all' | null {
  const token = localStorage.getItem('customer_token');
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    if (payload.isCompanyUser) {
      // For company users, check localStorage for selected customer
      const selected = localStorage.getItem('portal_selected_customer');
      if (selected === 'all' || !selected) return 'all';
      return parseInt(selected, 10);
    } else {
      // For customer users, return their customer ID
      return payload.customerId || null;
    }
  } catch {
    return null;
  }
}
