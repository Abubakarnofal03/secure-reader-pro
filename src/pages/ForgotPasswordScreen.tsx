import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'securereader://reset-password',
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

    setEmailSent(true);
  };

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
            {!emailSent ? (
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
                      <Mail className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] shadow-[var(--shadow-gold)]" />
                  </motion.div>

                  <h1 className="font-display text-3xl font-semibold text-foreground">
                    Forgot Password?
                  </h1>
                  <p className="mt-2 text-center text-muted-foreground">
                    Enter your email and we'll send you a reset link
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
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 rounded-xl border-border/80 bg-background pl-11"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>
                </motion.div>

                <Link
                  to="/login"
                  className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center text-center"
              >
                {/* Success Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10"
                >
                  <CheckCircle className="h-12 w-12 text-primary" />
                </motion.div>

                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Check Your Email
                </h1>
                <p className="mt-3 text-muted-foreground">
                  We've sent a password reset link to
                </p>
                <p className="mt-1 font-medium text-foreground">{email}</p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Click the link in your email to reset your password. The link will expire in 1 hour.
                </p>

                <div className="mt-8 w-full space-y-3">
                  <Button
                    variant="outline"
                    className="h-12 w-full rounded-xl"
                    onClick={() => setEmailSent(false)}
                  >
                    Try Different Email
                  </Button>
                  <Link to="/login" className="block">
                    <Button variant="ghost" className="h-12 w-full rounded-xl">
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Secure Password Reset</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
