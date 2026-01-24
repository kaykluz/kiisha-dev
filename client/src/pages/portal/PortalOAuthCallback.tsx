/**
 * Portal OAuth Callback Page
 * 
 * Handles OAuth redirects and completes authentication for the customer portal.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function PortalOAuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  
  const callbackMutation = trpc.customerPortal.handlePortalOAuthCallback.useMutation({
    onSuccess: (data) => {
      // Store token
      localStorage.setItem('customer_token', data.token);
      
      // Handle company users
      if (data.scope?.isCompanyUser && data.scope?.customers) {
        localStorage.setItem('portal_customers', JSON.stringify(data.scope.customers));
        localStorage.setItem('portal_is_company_user', 'true');
      } else {
        localStorage.removeItem('portal_customers');
        localStorage.removeItem('portal_is_company_user');
      }
      
      // Check if pending approval
      if (data.pendingApproval || data.user?.isPendingApproval) {
        setPendingApproval(true);
        return;
      }
      
      // Redirect to dashboard
      setLocation('/portal/dashboard');
    },
    onError: (err) => {
      setError(err.message || 'Authentication failed. Please try again.');
    },
  });
  
  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');
    
    if (errorParam) {
      setError(`OAuth error: ${errorParam}`);
      return;
    }
    
    if (!code || !state) {
      setError('Missing OAuth parameters');
      return;
    }
    
    // Verify state matches
    const storedState = localStorage.getItem('portal_oauth_state');
    if (state !== storedState) {
      setError('Invalid OAuth state. Please try again.');
      return;
    }
    
    // Extract provider from state (format: portal_provider_randomhex)
    const stateParts = state.split('_');
    if (stateParts.length < 3 || stateParts[0] !== 'portal') {
      setError('Invalid OAuth state format');
      return;
    }
    
    const provider = stateParts[1] as 'google' | 'github' | 'microsoft';
    
    // Clear stored state
    localStorage.removeItem('portal_oauth_state');
    
    // Exchange code for tokens
    callbackMutation.mutate({ provider, code, state });
  }, []);
  
  // Pending approval state
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        
        <Card className="w-full max-w-md relative bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Clock className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold text-white">Access Pending</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Your account has been created successfully
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <AlertDescription className="text-blue-300">
                Your service provider needs to grant you access to your account. 
                This may take some time. You'll be notified when your access is approved.
              </AlertDescription>
            </Alert>
            
            <Button 
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium"
              onClick={() => setLocation('/portal/login')}
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        
        <Card className="w-full max-w-md relative bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold text-white">Authentication Failed</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                We couldn't complete your sign in
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
            
            <Button 
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium"
              onClick={() => setLocation('/portal/login')}
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Loading state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <CardTitle className="text-2xl font-bold text-white">Signing In</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Please wait while we complete your authentication
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </CardContent>
      </Card>
    </div>
  );
}
