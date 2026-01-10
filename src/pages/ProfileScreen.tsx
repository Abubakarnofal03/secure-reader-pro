import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, LogOut, ChevronRight, Shield, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (!profile) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ChevronRight className="h-5 w-5 rotate-180 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Profile</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Profile Card */}
          <div className="flex flex-col items-center rounded-2xl bg-card p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary">
              <User className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              {profile.name || 'User'}
            </h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <div className="mt-3 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
              <Shield className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium capitalize text-primary">
                {profile.role}
              </span>
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-2">
            <h3 className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Account Info
            </h3>
            <div className="rounded-xl bg-card">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Access Status</p>
                  <p className="text-sm text-foreground">
                    {profile.has_access ? 'Approved' : 'Pending'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
