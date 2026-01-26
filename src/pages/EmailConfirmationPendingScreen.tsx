import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Shield, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function EmailConfirmationPendingScreen() {
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get email from navigation state
  const email = location.state?.email || '';

  // Listen for auth state changes (when user confirms email)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // User confirmed their email and is now signed in
        navigate('/library', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (!email || cooldown > 0) return;

    setIsResending(true);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/library`,
      },
    });

    setIsResending(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Email sent!',
      description: 'We\'ve sent another confirmation email.',
    });

    // Start 60-second cooldown
    setCooldown(60);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm text-center"
        >
          {/* Animated Email Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative mb-8 mx-auto"
          >
            <motion.div
              animate={{ 
                y: [0, -8, 0],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative"
            >
              <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-12 w-12 text-primary" />
              </div>
              {/* Floating notification dot */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] shadow-[var(--shadow-gold)] flex items-center justify-center"
              >
                <span className="text-xs font-bold text-white">1</span>
              </motion.div>
            </motion.div>
          </motion.div>

          <h1 className="font-display text-2xl font-semibold text-foreground">
            Check Your Email
          </h1>
          
          <p className="mt-3 text-muted-foreground">
            We've sent a confirmation link to
          </p>
          
          {email && (
            <p className="mt-1 font-medium text-foreground">{email}</p>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Click the link in your email to confirm your account and start exploring our medical publications.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 space-y-3">
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl"
              onClick={handleResendEmail}
              disabled={isResending || cooldown > 0 || !email}
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                'Resend Email'
              )}
            </Button>

            <Link to="/login" className="block">
              <Button variant="ghost" className="h-12 w-full rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </Link>
          </div>

          {/* Help Text */}
          <div className="mt-8 rounded-xl border border-border/50 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Didn't receive the email?</strong>
              <br />
              Check your spam folder or make sure you entered the correct email address.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Your information is secure & private</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
