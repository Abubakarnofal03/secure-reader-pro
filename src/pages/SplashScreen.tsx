import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showSplash && !loading) {
      if (user && profile) {
        if (profile.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (profile.has_access) {
          navigate('/library', { replace: true });
        } else {
          navigate('/access-pending', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [showSplash, loading, user, profile, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-foreground/10 backdrop-blur-sm">
            <BookOpen className="h-12 w-12 text-primary-foreground" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent"
          >
            <Shield className="h-4 w-4 text-accent-foreground" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-primary-foreground">
            SecureReader
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Protected Digital Library
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8"
        >
          <div className="h-1 w-16 overflow-hidden rounded-full bg-primary-foreground/20">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5, 
                ease: 'easeInOut' 
              }}
              className="h-full w-1/2 rounded-full bg-primary-foreground/60"
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
