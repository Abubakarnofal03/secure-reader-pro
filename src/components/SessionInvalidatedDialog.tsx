import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Smartphone } from 'lucide-react';

export function SessionInvalidatedDialog() {
  const { sessionInvalidated, clearSessionInvalidated } = useAuth();

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
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={clearSessionInvalidated}>
            Sign In Again
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
