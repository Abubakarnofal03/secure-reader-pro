import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // The user should have a session if they clicked the reset link
      if (session) {
        setIsValidSession(true);
        return;
      }
      
      // Check URL for recovery token in hash (web flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // Also check query params (deep link flow might use query params)
      const searchParams = new URLSearchParams(window.location.search);
      const queryToken = searchParams.get('access_token');
      const queryType = searchParams.get('type');
      
      const token = accessToken || queryToken;
      const tokenType = type || queryType;
      
      if (token && tokenType === 'recovery') {
        // Set the session from the recovery token
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token') || '';
        const { error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken,
        });
        
        if (!error) {
          setIsValidSession(true);
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          setIsValidSession(false);
        }
      } else {
        setIsValidSession(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setIsSuccess(true);

    // Sign out and redirect to login after 3 seconds
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }, 3000);
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Invalid session - no recovery token
  if (isValidSession === false) {
    return (
      <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="mb-6 flex mx-auto h-24 w-24 items-center justify-center rounded-full bg-destructive/10"
            >
              <AlertCircle className="h-12 w-12 text-destructive" />
            </motion.div>

            <h1 className="font-display text-2xl font-semibold text-foreground">
              Invalid or Expired Link
            </h1>
            <p className="mt-3 text-muted-foreground">
              This password reset link is invalid or has expired. Please request a new one.
            </p>

            <Button
              className="mt-8 h-12 w-full rounded-xl"
              onClick={() => navigate('/forgot-password')}
            >
              Request New Link
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm"
        >
          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div className="mb-10 flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="relative mb-6"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-[var(--shadow-lg)]">
                      <Lock className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] shadow-[var(--shadow-gold)]" />
                  </motion.div>

                  <h1 className="font-display text-3xl font-semibold text-foreground">
                    Reset Password
                  </h1>
                  <p className="mt-2 text-center text-muted-foreground">
                    Enter your new password below
                  </p>
                </div>

                {/* Form Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-lg)]"
                >
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">
                        New Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 rounded-xl border-border/80 bg-background pl-11 pr-11"
                          required
                          autoComplete="new-password"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-12 rounded-xl border-border/80 bg-background pl-11 pr-11"
                          required
                          autoComplete="new-password"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </form>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10"
                >
                  <CheckCircle className="h-12 w-12 text-primary" />
                </motion.div>

                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Password Updated!
                </h1>
                <p className="mt-3 text-muted-foreground">
                  Your password has been successfully reset. Redirecting you to sign in...
                </p>

                <div className="mt-6 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Secure Password Update</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
