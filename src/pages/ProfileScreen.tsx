import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, LogOut, ChevronRight, Shield, Mail, Crown, BookOpen, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (!profile) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="flex h-16 items-center gap-4 px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary"
          >
            <ChevronRight className="h-5 w-5 rotate-180 text-foreground" />
          </button>
          <h1 className="font-display text-xl font-semibold">Profile</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-md space-y-6"
        >
          {/* Profile Card */}
          <div className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-lg)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)]" />
            
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-[var(--shadow-md)]">
                  <User className="h-12 w-12 text-primary-foreground" />
                </div>
                {profile.role === 'admin' && (
                  <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] shadow-[var(--shadow-gold)]">
                    <Crown className="h-4 w-4 text-[hsl(222_47%_11%)]" />
                  </div>
                )}
              </div>

              <h2 className="mt-5 font-display text-2xl font-semibold">{profile.name || 'Reader'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>

              <div className="mt-4">
                {profile.role === 'admin' ? (
                  <span className="badge-premium"><Crown className="h-3.5 w-3.5" />Administrator</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    <BookOpen className="h-3.5 w-3.5" />Reader
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-md)]">
            <div className="px-5 py-4 border-b border-border/50">
              <h3 className="font-display text-lg font-semibold">Account Details</h3>
            </div>
            <div className="divide-y divide-border/50">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                  <p className="text-sm font-medium">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Access Status</p>
                  <p className="text-sm font-medium">
                    {profile.has_access ? <span className="text-[hsl(var(--success))]">Active</span> : <span className="text-[hsl(var(--warning))]">Pending</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-md)]">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Appearance</p>
                  <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'AMOLED Dark' : 'Light Mode'}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />Sign Out
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
