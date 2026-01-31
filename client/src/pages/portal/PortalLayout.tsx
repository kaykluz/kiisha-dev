/**
 * Customer Portal Layout
 * 
 * Shared layout component for all portal pages.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Zap, LogOut, User, LayoutDashboard, FileText, CreditCard, FolderOpen, Files } from 'lucide-react';

interface PortalLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/portal/dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', href: '/portal/invoices', icon: FileText },
  { id: 'payments', label: 'Payments', href: '/portal/payments', icon: CreditCard },
  { id: 'projects', label: 'Projects', href: '/portal/projects', icon: FolderOpen },
  { id: 'documents', label: 'Documents', href: '/portal/documents', icon: Files },
];

export default function PortalLayout({ children, activeTab }: PortalLayoutProps) {
  const [, setLocation] = useLocation();
  
  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setLocation('/portal/login');
    }
  }, [setLocation]);
  
  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    setLocation('/portal/login');
  };
  
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
                <h1 className="text-lg font-semibold text-white">Customer Portal</h1>
                <p className="text-sm text-slate-400">KIISHA</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <User className="w-4 h-4 mr-2" />
                Profile
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
            Powered by KIISHA • Need help? Contact your service provider
          </p>
        </div>
      </footer>
    </div>
  );
}
