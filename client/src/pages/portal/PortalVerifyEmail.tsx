/**
 * Portal Email Verification Page
 * 
 * Handles email verification for customer portal accounts.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function PortalVerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  const verifyMutation = trpc.customerPortal.verifyCustomerEmail.useMutation({
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message);
    },
    onError: (err) => {
      setStatus('error');
      setMessage(err.message || 'Verification failed. Please try again.');
    },
  });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token');
      return;
    }
    
    verifyMutation.mutate({ token });
  }, []);
  
  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        
        <Card className="w-full max-w-md relative bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold text-white">Email Verified</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Your email has been verified successfully
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <AlertDescription className="text-blue-300">
                {message || 'Your service provider will need to grant you access to your account. You will be notified when your access is approved.'}
              </AlertDescription>
            </Alert>
            
            <Button 
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium"
              onClick={() => setLocation('/portal/login')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (status === 'error') {
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
              <CardTitle className="text-2xl font-bold text-white">Verification Failed</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                We couldn't verify your email
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
              <AlertDescription className="text-red-400">{message}</AlertDescription>
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
            <CardTitle className="text-2xl font-bold text-white">Verifying Email</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Please wait while we verify your email address
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
