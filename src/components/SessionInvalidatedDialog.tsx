import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Smartphone, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function SessionInvalidatedDialog() {
  const { sessionInvalidated, clearSessionInvalidated, signIn } = useAuth();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginHere = async () => {
    if (!email || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Please enter your email and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: 'Login failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Logged in successfully',
          description: 'You are now logged in on this device.',
        });
        clearSessionInvalidated();
        setShowLoginForm(false);
        setEmail('');
        setPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    clearSessionInvalidated();
    setShowLoginForm(false);
    setEmail('');
    setPassword('');
  };

  return (
    <AlertDialog open={sessionInvalidated} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Smartphone className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            Session Ended
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your account was logged in on another device. For security, only one active session is allowed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showLoginForm ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="session-email">Email</Label>
              <Input
                id="session-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-password">Password</Label>
              <div className="relative">
                <Input
                  id="session-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLoginHere();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {showLoginForm ? (
            <>
              <Button
                onClick={handleLoginHere}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login on This Device'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowLoginForm(false)}
                disabled={isLoading}
                className="w-full"
              >
                Back
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setShowLoginForm(true)}
                className="w-full"
              >
                Login Here
              </Button>
              <AlertDialogAction
                onClick={handleDismiss}
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Go to Sign In Page
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
