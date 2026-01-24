import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSessionRecoveryOptions {
  /** Called when session is recovered after being lost */
  onSessionRecovered?: () => void;
  /** Called when session recovery fails after all retries */
  onRecoveryFailed?: (error: Error) => void;
  /** Whether recovery is enabled */
  enabled?: boolean;
  /** Max retry attempts for session recovery */
  maxRetries?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
}

interface UseSessionRecoveryResult {
  /** Whether session recovery is in progress */
  isRecovering: boolean;
  /** Whether the session is valid */
  hasValidSession: boolean;
  /** Force a session refresh */
  refreshSession: () => Promise<boolean>;
  /** Last recovery attempt timestamp */
  lastRecoveryAt: number | null;
}

/**
 * Hook to automatically recover Supabase sessions when the app regains focus.
 * This handles scenarios like:
 * - User takes a phone call and returns to the app
 * - User switches to another app and comes back
 * - Session token expires during idle time
 * 
 * The hook monitors document visibility and automatically refreshes the session
 * when the user returns to the app.
 */
export function useSessionRecovery({
  onSessionRecovered,
  onRecoveryFailed,
  enabled = true,
  maxRetries = 3,
  retryDelay = 1000,
}: UseSessionRecoveryOptions = {}): UseSessionRecoveryResult {
  const [isRecovering, setIsRecovering] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(true);
  const [lastRecoveryAt, setLastRecoveryAt] = useState<number | null>(null);
  
  const retryCountRef = useRef(0);
  const isRecoveringRef = useRef(false);
  const lastVisibleTimeRef = useRef(Date.now());

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (isRecoveringRef.current) {
      console.log('[SessionRecovery] Recovery already in progress');
      return false;
    }

    isRecoveringRef.current = true;
    setIsRecovering(true);

    try {
      console.log('[SessionRecovery] Attempting session refresh...');
      
      // First, try to get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[SessionRecovery] Error getting session:', sessionError);
        throw sessionError;
      }

      if (!session) {
        console.log('[SessionRecovery] No session found, attempting token refresh...');
        
        // Try to refresh the token
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[SessionRecovery] Token refresh failed:', refreshError);
          throw refreshError;
        }

        if (!refreshData.session) {
          throw new Error('Session refresh returned no session');
        }

        console.log('[SessionRecovery] Session refreshed successfully');
      } else {
        // Session exists, check if it needs refresh (token expiring soon)
        const tokenExpiry = session.expires_at ? session.expires_at * 1000 : 0;
        const now = Date.now();
        const timeUntilExpiry = tokenExpiry - now;
        
        // If token expires in less than 5 minutes, proactively refresh
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('[SessionRecovery] Token expiring soon, refreshing...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.warn('[SessionRecovery] Proactive refresh failed:', refreshError);
            // Don't throw - session still valid
          } else {
            console.log('[SessionRecovery] Proactive token refresh successful');
          }
        } else {
          console.log('[SessionRecovery] Session valid, expires in', Math.round(timeUntilExpiry / 1000), 'seconds');
        }
      }

      setHasValidSession(true);
      setLastRecoveryAt(Date.now());
      retryCountRef.current = 0;
      onSessionRecovered?.();
      
      return true;
    } catch (error) {
      console.error('[SessionRecovery] Recovery attempt failed:', error);
      
      retryCountRef.current++;
      
      if (retryCountRef.current < maxRetries) {
        console.log(`[SessionRecovery] Retrying in ${retryDelay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        isRecoveringRef.current = false;
        setIsRecovering(false);
        
        return refreshSession();
      }
      
      setHasValidSession(false);
      onRecoveryFailed?.(error instanceof Error ? error : new Error('Session recovery failed'));
      
      return false;
    } finally {
      isRecoveringRef.current = false;
      setIsRecovering(false);
    }
  }, [maxRetries, retryDelay, onSessionRecovered, onRecoveryFailed]);

  // Handle visibility change - when user returns to the app
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const hiddenDuration = Date.now() - lastVisibleTimeRef.current;
        console.log(`[SessionRecovery] App became visible after ${Math.round(hiddenDuration / 1000)}s`);
        
        // If hidden for more than 30 seconds, refresh session
        if (hiddenDuration > 30 * 1000) {
          console.log('[SessionRecovery] Hidden for >30s, refreshing session...');
          await refreshSession();
        }
      } else {
        lastVisibleTimeRef.current = Date.now();
      }
    };

    // Handle app focus (for native apps)
    const handleFocus = async () => {
      console.log('[SessionRecovery] Window focused, checking session...');
      await refreshSession();
    };

    // Handle online/offline transitions
    const handleOnline = async () => {
      console.log('[SessionRecovery] Network reconnected, refreshing session...');
      await refreshSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // Initial session check
    refreshSession();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, refreshSession]);

  // Periodic session check every 2 minutes
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('[SessionRecovery] Periodic session check...');
        refreshSession();
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, refreshSession]);

  return {
    isRecovering,
    hasValidSession,
    refreshSession,
    lastRecoveryAt,
  };
}
