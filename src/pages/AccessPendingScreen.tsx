import { motion } from 'framer-motion';
import { Clock, LogOut, RefreshCw, Shield } from 'lucide-react';
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
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-sm text-center"
        >
          {/* Premium pending icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mx-auto mb-8 relative"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(43_74%_49%/0.15)] to-[hsl(38_72%_55%/0.1)] border border-[hsl(43_74%_49%/0.3)]">
              <Clock className="h-12 w-12 text-[hsl(43_74%_49%)]" />
            </div>
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[hsl(43_74%_49%/0.3)] animate-pulse" />
          </motion.div>

          <h1 className="font-display text-3xl font-semibold text-foreground">
            Access Pending
          </h1>
          
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Your account is awaiting administrator approval. You'll be notified once your access request has been reviewed.
          </p>

          {profile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-8 rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-md)]"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Signed in as
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-foreground">
                {profile.name || 'Reader'}
              </p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-8 space-y-3"
          >
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
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
          </motion.div>

          {/* Trust indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Secure verification in progress</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
