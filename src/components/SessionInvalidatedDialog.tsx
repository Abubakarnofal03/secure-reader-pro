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
import { useNavigate } from 'react-router-dom';

export function SessionInvalidatedDialog() {
  const { sessionInvalidated, clearSessionInvalidated } = useAuth();
  const navigate = useNavigate();

  const handleGoToLogin = () => {
    clearSessionInvalidated();
    navigate('/login', { replace: true });
  };

  return (
    <AlertDialog open={sessionInvalidated} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
            <Smartphone className="h-8 w-8 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center font-display text-xl">
            Session Ended
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center leading-relaxed">
            Your account was logged in on another device. For security, only one active session is allowed at a time.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-col">
          <AlertDialogAction
            onClick={handleGoToLogin}
            className="w-full h-12 rounded-xl"
          >
            Go to Sign In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
