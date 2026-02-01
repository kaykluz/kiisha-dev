/**
 * Customer Portal Login Page
 * 
 * Separate authentication for customers to access
 * their invoices, payments, and project information.
 * Supports email/password and OAuth authentication.
 */

import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Zap, Mail, Lock, ArrowRight, Chrome, Github } from 'lucide-react';
import { trpc } from '@/lib/trpc';

// Microsoft icon component
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

export default function PortalLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Get available OAuth providers
  const { data: providers } = trpc.customerPortal.getPortalOAuthProviders.useQuery();
  
  const loginMutation = trpc.customerPortal.customerLogin.useMutation({
    onSuccess: (data) => {
      // Store token in localStorage for customer portal
      localStorage.setItem('customer_token', data.token);
      
      // For company users, also store the list of accessible customers
      if (data.scope?.isCompanyUser && data.scope?.customers) {
        localStorage.setItem('portal_customers', JSON.stringify(data.scope.customers));
        localStorage.setItem('portal_is_company_user', 'true');
      } else {
        localStorage.removeItem('portal_customers');
        localStorage.removeItem('portal_is_company_user');
      }
      
      setLocation('/portal/dashboard');
    },
    onError: (err) => {
      setError(err.message || 'Login failed. Please check your credentials.');
    },
  });
  
  const oauthMutation = trpc.customerPortal.getPortalOAuthUrl.useMutation({
    onSuccess: (data) => {
      // Store state for verification
      localStorage.setItem('portal_oauth_state', data.state);
      // Redirect to OAuth provider
      window.location.href = data.url;
    },
    onError: (err) => {
      setError(err.message || 'Failed to initiate OAuth login');
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    
    loginMutation.mutate({ email, password });
  };
  
  const handleOAuthLogin = (provider: 'google' | 'github' | 'microsoft') => {
    setError('');
    oauthMutation.mutate({ provider });
  };
  
  const isLoading = loginMutation.isPending || oauthMutation.isPending;
  
  // Filter to only show configured providers
  const configuredProviders = providers?.filter(p => p.configured) || [];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <CardTitle className="text-2xl font-bold text-white">Customer Portal</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Access your invoices, payments, and project information
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}
          
          {/* OAuth Buttons */}
          {configuredProviders.length > 0 && (
            <>
              <div className="space-y-3">
                {configuredProviders.map((provider) => (
                  <Button
                    key={provider.provider}
                    type="button"
                    variant="outline"
                    className="w-full bg-slate-900/50 border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500"
                    onClick={() => handleOAuthLogin(provider.provider as 'google' | 'github' | 'microsoft')}
                    disabled={isLoading}
                  >
                    {provider.provider === 'google' && <Chrome className="w-4 h-4 mr-2" />}
                    {provider.provider === 'github' && <Github className="w-4 h-4 mr-2" />}
                    {provider.provider === 'microsoft' && <MicrosoftIcon className="w-4 h-4 mr-2" />}
                    Continue with {provider.name}
                  </Button>
                ))}
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-800 px-2 text-slate-400">or continue with email</span>
                </div>
              </div>
            </>
          )}
          
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Link 
                  href="/portal/forgot-password" 
                  className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium"
              disabled={isLoading}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
          
          <div className="pt-4 border-t border-slate-700">
            <p className="text-center text-sm text-slate-400">
              Don't have an account?{' '}
              <Link 
                href="/portal/signup" 
                className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
              >
                Create one
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Footer */}
      <div className="absolute bottom-4 text-center text-sm text-slate-500">
        <p>Powered by KIISHA</p>
      </div>
    </div>
  );
}
