import { motion } from 'framer-motion';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function AccessPendingScreen() {
  const { profile, signOut, refreshProfile } = useAuth();

  const handleRefresh = async () => {
    await refreshProfile();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm text-center"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warning/10"
          >
            <Clock className="h-10 w-10 text-warning" />
          </motion.div>

          <h1 className="text-2xl font-bold text-foreground">
            Access Pending
          </h1>
          
          <p className="mt-3 text-muted-foreground">
            Your account is awaiting approval. An administrator will review your access request shortly.
          </p>

          {profile && (
            <div className="mt-6 rounded-lg bg-card p-4">
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="mt-1 font-medium text-foreground">
                {profile.name || profile.email}
              </p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Status
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
