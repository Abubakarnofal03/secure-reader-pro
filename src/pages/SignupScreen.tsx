import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Shield, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

    setIsLoading(true);

    const { error } = await signUp(email, password, name);

    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Account created',
      description: 'Please wait for admin approval to access content.',
    });

    navigate('/access-pending', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Premium Header */}
          <div className="mb-10 flex flex-col items-center">
            {/* Premium Logo Mark */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="relative mb-6"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-[var(--shadow-lg)]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-primary/80" />
                <BookOpen className="relative h-10 w-10 text-primary-foreground" />
              </div>
              {/* Gold accent */}
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] shadow-[var(--shadow-gold)]" />
            </motion.div>

            <h1 className="font-display text-3xl font-semibold text-foreground">
              Create Account
            </h1>
            <p className="mt-2 text-center text-muted-foreground">
              Join our exclusive medical publications platform
            </p>
          </div>

          {/* Premium Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-lg)]"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Dr. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-background pl-11 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

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
                    className="h-12 rounded-xl border-border/80 bg-background pl-11 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-border/80 bg-background pl-11 pr-11 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </motion.div>

          {/* Sign in link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Sign In
            </Link>
          </motion.p>

          {/* Trust indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Your information is secure & private</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
