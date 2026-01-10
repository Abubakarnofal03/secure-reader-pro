import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  has_access: boolean;
  active_device_id: string | null;
  last_login_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sessionInvalidated: boolean;
  clearSessionInvalidated: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);

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
    const deviceId = getDeviceId();
    
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
    const deviceId = getDeviceId();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      // Update device ID and last login
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
      const profileData = await fetchProfile(data.user.id);
      if (profileData) {
        setProfile(profileData);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
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
        clearSessionInvalidated
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
