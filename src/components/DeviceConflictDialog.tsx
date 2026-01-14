import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Smartphone, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function DeviceConflictDialog() {
  const { pendingDeviceConflict, confirmLoginOnThisDevice, cancelDeviceConflict } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginHere = async () => {
    setIsLoading(true);
    try {
      const { error } = await confirmLoginOnThisDevice();
      if (error) {
        toast({
          title: 'Login failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Logged in successfully',
          description: 'The other device has been logged out.',
        });
        navigate('/', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    cancelDeviceConflict();
  };

  return (
    <AlertDialog open={pendingDeviceConflict} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--warning)/0.15)] border border-[hsl(var(--warning)/0.3)]">
            <Smartphone className="h-8 w-8 text-[hsl(var(--warning))]" />
          </div>
          <AlertDialogTitle className="text-center font-display text-xl">
            Already Logged In
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center leading-relaxed">
            Your account is currently active on another device. Would you like to log in here instead?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 rounded-xl bg-muted/50 border border-border/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Logging in here will automatically sign out the other device for security.
            </p>
          </div>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleLoginHere}
            disabled={isLoading}
            className="w-full h-12 rounded-xl"
            variant="premium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <Smartphone className="mr-2 h-4 w-4" />
                Login on This Device
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full h-11 rounded-xl"
          >
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
