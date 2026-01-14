import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, clearDeviceId } from '@/lib/device';

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

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile;
  };

  const validateSession = async (profileData: Profile) => {
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
              await validateSession(profileData);
            }
          }, 0);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then((profileData) => {
          if (profileData) {
            setProfile(profileData);
            validateSession(profileData);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
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
        // Device conflict detected - store credentials and show confirmation
        setPendingLogin({ email, password, userId: data.user.id });
        setPendingDeviceConflict(true);
        
        // Sign out temporarily (we'll sign back in when user confirms)
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        
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

      // Refresh profile to get updated data
      if (profileData) {
        setProfile({ ...profileData, active_device_id: deviceId });
      }
    }

    return { error: null };
  };

  const confirmLoginOnThisDevice = async () => {
    if (!pendingLogin) {
      return { error: new Error('No pending login') };
    }

    const deviceId = await getDeviceId();
    const { email, password, userId } = pendingLogin;

    // Sign in again
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
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

      // Fetch and set profile
      const profileData = await fetchProfile(data.user.id);
      if (profileData) {
        setProfile({ ...profileData, active_device_id: deviceId });
      }
    }

    // Clear pending state
    setPendingLogin(null);
    setPendingDeviceConflict(false);

    return { error: null };
  };

  const cancelDeviceConflict = () => {
    setPendingLogin(null);
    setPendingDeviceConflict(false);
  };

  const signOut = async () => {
    // Clear device ID from profile before signing out
    if (user) {
      await supabase
        .from('profiles')
        .update({ active_device_id: null })
        .eq('id', user.id);
    }
    
    // Clear local device ID using the storage utility
    await clearDeviceId();
    
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
