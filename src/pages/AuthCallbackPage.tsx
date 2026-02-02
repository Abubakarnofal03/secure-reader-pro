import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

/**
 * Minimal auth callback page that handles Supabase redirects.
 * This page is designed to be the ONLY published web page.
 * It captures auth tokens and redirects to the native app.
 */
export default function AuthCallbackPage() {
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we're already in the native app, let the normal auth flow handle it
    if (Capacitor.isNativePlatform()) {
      return;
    }

    const handleCallback = () => {
      try {
        // Get tokens from URL hash (Supabase uses hash for tokens)
        const hash = window.location.hash;
        
        // Parse hash parameters
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Also check for error in hash
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');
        
        if (errorCode || errorDescription) {
          setError(errorDescription || 'Authentication failed');
          return;
        }

        // Determine the redirect type
        let appPath = 'library';
        if (type === 'recovery') {
          appPath = 'reset-password';
        } else if (type === 'signup' || type === 'email') {
          appPath = 'library';
        }

        // Build the deep link URL
        let deepLinkUrl = `mycalorics://${appPath}`;
        
        // Append tokens as query parameters for the app to use
        if (accessToken) {
          const params = new URLSearchParams();
          params.set('access_token', accessToken);
          if (refreshToken) params.set('refresh_token', refreshToken);
          if (type) params.set('type', type);
          deepLinkUrl += `?${params.toString()}`;
        } else if (hash) {
          // Pass the hash as-is if no parsed tokens
          deepLinkUrl += hash;
        }

        console.log('Attempting to open app with:', deepLinkUrl);
        
        // Attempt to redirect to the app
        setRedirectAttempted(true);
        window.location.href = deepLinkUrl;

        // If we're still here after a delay, the redirect didn't work
        setTimeout(() => {
          // User is still on this page, show manual instructions
        }, 2000);
      } catch (err) {
        console.error('Error handling auth callback:', err);
        setError('Failed to process authentication');
      }
    };

    handleCallback();
  }, []);

  const handleManualOpen = () => {
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));
    const type = hashParams.get('type');
    
    let appPath = type === 'recovery' ? 'reset-password' : 'library';
    window.location.href = `mycalorics://${appPath}${hash}`;
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-destructive/10">
            <img src={logo} alt="MyCalorics" className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">Authentication Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <p className="text-sm text-muted-foreground/70">
            Please try again or request a new link from the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-primary/10">
          <img src={logo} alt="MyCalorics" className="h-12 w-auto" />
        </div>
        
        <h1 className="text-2xl font-semibold text-foreground mb-3">
          Opening MyCalorics...
        </h1>
        
        {!redirectAttempted ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Processing authentication...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              If the app didn't open automatically, tap the button below:
            </p>
            
            <Button 
              onClick={handleManualOpen}
              className="w-full h-12 rounded-xl gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open MyCalorics App
            </Button>
            
            <p className="text-xs text-muted-foreground/70 mt-4">
              Make sure MyCalorics is installed on your device.
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
          <Smartphone className="h-3.5 w-3.5" />
          <span>Secure Authentication</span>
        </div>
      </div>
    </div>
  );
}
