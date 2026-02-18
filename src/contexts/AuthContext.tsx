import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, clearDeviceId } from '@/lib/device';
import { storage } from '@/lib/storage';

const CACHED_PROFILE_KEY = 'secure_reader_cached_profile';
const LOGIN_FLAG_KEY = 'secure_reader_logged_in';
const CACHED_USER_KEY = 'secure_reader_cached_user';
const CACHED_SESSION_KEY = 'secure_reader_cached_session';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  has_access: boolean;
  active_device_id: string | null;
  last_login_at: string | null;
}

interface PendingLogin {
  email: string;
  password: string;
  userId: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; deviceConflict?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sessionInvalidated: boolean;
  clearSessionInvalidated: () => void;
  // New: for handling device conflicts during login
  pendingDeviceConflict: boolean;
  confirmLoginOnThisDevice: () => Promise<{ error: Error | null }>;
  cancelDeviceConflict: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);
  const [pendingDeviceConflict, setPendingDeviceConflict] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
  // Use ref to persist pendingLogin across React state updates during auth changes
  const pendingLoginRef = useRef<PendingLogin | null>(null);

  const cacheProfile = async (profileData: Profile) => {
    try {
      await storage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profileData));
    } catch (e) {
      console.warn('Failed to cache profile:', e);
    }
  };

  const getCachedProfile = async (): Promise<Profile | null> => {
    try {
      const cached = await storage.getItem(CACHED_PROFILE_KEY);
      if (cached) {
        return JSON.parse(cached) as Profile;
      }
    } catch (e) {
      console.warn('Failed to load cached profile:', e);
    }
    return null;
  };

  const clearCachedProfile = async () => {
    try {
      await storage.removeItem(CACHED_PROFILE_KEY);
      await storage.removeItem(LOGIN_FLAG_KEY);
      await storage.removeItem(CACHED_USER_KEY);
      await storage.removeItem(CACHED_SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear cached profile:', e);
    }
  };

  /** Persist login state so the app never forgets the user on native */
  const persistLoginState = async (userData: User, sessionData: Session, profileData: Profile) => {
    try {
      await storage.setItem(LOGIN_FLAG_KEY, 'true');
      await storage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
      await storage.setItem(CACHED_SESSION_KEY, JSON.stringify(sessionData));
      await cacheProfile(profileData);
      console.log('[Auth] Login state persisted for offline access');
    } catch (e) {
      console.warn('Failed to persist login state:', e);
    }
  };

  /** Load cached login state when Supabase session isn't available (offline) */
  const loadCachedLoginState = async (): Promise<{ user: User; session: Session; profile: Profile } | null> => {
    try {
      const flag = await storage.getItem(LOGIN_FLAG_KEY);
      if (flag !== 'true') return null;

      const [cachedUser, cachedSession, cachedProfile] = await Promise.all([
        storage.getItem(CACHED_USER_KEY),
        storage.getItem(CACHED_SESSION_KEY),
        storage.getItem(CACHED_PROFILE_KEY),
      ]);

      if (cachedUser && cachedSession && cachedProfile) {
        console.log('[Auth] Restoring cached login state (offline-safe)');
        return {
          user: JSON.parse(cachedUser) as User,
          session: JSON.parse(cachedSession) as Session,
          profile: JSON.parse(cachedProfile) as Profile,
        };
      }
    } catch (e) {
      console.warn('Failed to load cached login state:', e);
    }
    return null;
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // Fall back to cached profile when offline
        const cached = await getCachedProfile();
        if (cached && cached.id === userId) {
          console.log('[Auth] Using cached profile (offline)');
          return cached;
        }
        return null;
      }

      const profileData = data as Profile;
      // Cache profile for offline use
      await cacheProfile(profileData);
      return profileData;
    } catch (err) {
      console.error('Error fetching profile (likely offline):', err);
      // Fall back to cached profile
      const cached = await getCachedProfile();
      if (cached && cached.id === userId) {
        console.log('[Auth] Using cached profile (offline fallback)');
        return cached;
      }
      return null;
    }
  };

  const validateSession = async (profileData: Profile) => {
    // Skip device validation when offline — cached profile data may be stale
    if (!navigator.onLine) return true;

    const deviceId = await getDeviceId();

    if (profileData.active_device_id && profileData.active_device_id !== deviceId) {
      // Session was taken over by another device
      setSessionInvalidated(true);
      await signOut();
      return false;
    }
    return true;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Use setTimeout to avoid potential race condition
          setTimeout(async () => {
            const profileData = await fetchProfile(currentSession.user.id);
            if (profileData) {
              setProfile(profileData);
              // Persist login state for offline resilience
              await persistLoginState(currentSession.user, currentSession, profileData);
              await validateSession(profileData);
            }
          }, 0);
        } else {
          // Only clear profile if we're not in a pending device conflict state
          // This prevents wiping the state during the conflict resolution flow
          if (!pendingDeviceConflict) {
            setProfile(null);
          }
        }

        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        fetchProfile(currentSession.user.id).then(async (profileData) => {
          if (profileData) {
            setProfile(profileData);
            await persistLoginState(currentSession.user, currentSession, profileData);
            validateSession(profileData);
          }
          setLoading(false);
        });
      } else {
        // No Supabase session — try to restore from local cache (offline/token expired)
        const cached = await loadCachedLoginState();
        if (cached) {
          console.log('[Auth] No active session but found cached login — restoring');
          setUser(cached.user);
          setSession(cached.session);
          setProfile(cached.profile);
          // Try to refresh in background if online
          if (navigator.onLine) {
            supabase.auth.refreshSession().then(({ data }) => {
              if (data.session) {
                console.log('[Auth] Background token refresh successful');
                setSession(data.session);
                setUser(data.session.user);
                persistLoginState(data.session.user, data.session, cached.profile);
              }
            }).catch(() => {
              console.log('[Auth] Background refresh failed — staying with cached state');
            });
          }
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [pendingDeviceConflict]);

  const signUp = async (email: string, password: string, name: string) => {
    // Use the web auth callback page which will redirect to the app
    const redirectUrl = `${window.location.origin}/auth-callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const deviceId = await getDeviceId();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      // Check if there's an active session on another device
      const profileData = await fetchProfile(data.user.id);

      if (profileData?.active_device_id && profileData.active_device_id !== deviceId) {
        // Device conflict detected - store credentials BEFORE signing out
        // Store in both state and ref to ensure persistence across re-renders
        const loginCredentials = { email, password, userId: data.user.id };
        pendingLoginRef.current = loginCredentials;
        setPendingLogin(loginCredentials);
        setPendingDeviceConflict(true);

        // Sign out temporarily but keep the pending state
        await supabase.auth.signOut();

        return { error: null, deviceConflict: true };
      }

      // No conflict - proceed with login
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          active_device_id: deviceId,
          last_login_at: new Date().toISOString()
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Error updating device session:', updateError);
      }

      // Refresh profile to get updated data and persist login state
      if (profileData && data.session) {
        const updatedProfile = { ...profileData, active_device_id: deviceId };
        setProfile(updatedProfile);
        await persistLoginState(data.user, data.session, updatedProfile);
      }
    }

    return { error: null };
  };

  const confirmLoginOnThisDevice = async () => {
    // Use ref as fallback since state might not be updated yet during rapid re-renders
    const credentials = pendingLogin || pendingLoginRef.current;
    if (!credentials) {
      return { error: new Error('No pending login') };
    }

    const deviceId = await getDeviceId();
    const { email, password } = credentials;

    try {
      // Sign in again
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Clear pending state on error
        setPendingLogin(null);
        setPendingDeviceConflict(false);
        return { error };
      }

      if (data.user) {
        // Force update device ID - this logs out the other device
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            active_device_id: deviceId,
            last_login_at: new Date().toISOString()
          })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error updating device session:', updateError);
        }

        // Fetch profile with retry logic in case of timing issues
        let profileData = null;
        for (let i = 0; i < 3; i++) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profileError && profile) {
            profileData = profile as Profile;
            break;
          }
          // Small delay before retry
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        if (profileData) {
          setProfile({ ...profileData, active_device_id: deviceId });
        }

        // Set user and session from the sign-in response
        setUser(data.user);
        setSession(data.session);
      }

      // Clear pending state including ref
      pendingLoginRef.current = null;
      setPendingLogin(null);
      setPendingDeviceConflict(false);

      return { error: null };
    } catch (err) {
      // Clear pending state on any error
      pendingLoginRef.current = null;
      setPendingLogin(null);
      setPendingDeviceConflict(false);
      return { error: err as Error };
    }
  };

  const cancelDeviceConflict = () => {
    pendingLoginRef.current = null;
    setPendingLogin(null);
    setPendingDeviceConflict(false);
  };

  const signOut = async () => {
    // Clear device ID from profile before signing out
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ active_device_id: null })
          .eq('id', user.id);
      } catch {
        // Ignore errors if offline
      }
    }

    // Clear local device ID using the storage utility
    await clearDeviceId();
    // Clear cached profile
    await clearCachedProfile();

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const clearSessionInvalidated = () => {
    setSessionInvalidated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        sessionInvalidated,
        clearSessionInvalidated,
        pendingDeviceConflict,
        confirmLoginOnThisDevice,
        cancelDeviceConflict
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
