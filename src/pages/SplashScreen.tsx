import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [animationPhase, setAnimationPhase] = useState<'closed' | 'opening' | 'open'>('closed');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Start opening animation after a brief pause
    const openTimer = setTimeout(() => {
      setAnimationPhase('opening');
    }, 300);

    // Book fully open
    const fullyOpenTimer = setTimeout(() => {
      setAnimationPhase('open');
    }, 1200);

    // End splash
    const endTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(fullyOpenTimer);
      clearTimeout(endTimer);
    };
  }, []);

  useEffect(() => {
    if (!showSplash && !loading) {
      if (user && profile) {
        if (profile.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/library', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [showSplash, loading, user, profile, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary safe-top safe-bottom overflow-hidden">
      {/* Background pattern - subtle book texture */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 2px,
            hsl(var(--primary-foreground) / 0.1) 2px,
            hsl(var(--primary-foreground) / 0.1) 4px
          )`
        }} />
      </div>

      <div className="relative flex flex-col items-center">
        {/* Book Animation Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative w-40 h-52 perspective-1000"
          style={{ perspective: '1000px' }}
        >
          {/* Book Spine */}
          <motion.div
            className="absolute left-1/2 top-0 w-4 h-full bg-gradient-to-r from-primary-foreground/20 to-primary-foreground/10 rounded-l-sm"
            style={{ 
              transformOrigin: 'left center',
              transform: 'translateX(-50%)',
              zIndex: 10
            }}
          />

          {/* Back Cover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/15 to-primary-foreground/5 rounded-r-md rounded-l-sm border border-primary-foreground/20 shadow-2xl">
            <div className="absolute inset-2 border border-primary-foreground/10 rounded" />
          </div>

          {/* Pages (visible when opening) */}
          <AnimatePresence>
            {animationPhase !== 'closed' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-y-1 left-1/2 right-1 bg-gradient-to-r from-amber-50/90 to-amber-100/80 rounded-r"
                style={{ marginLeft: '8px' }}
              >
                {/* Page lines */}
                <div className="absolute inset-3 flex flex-col justify-center gap-1.5">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 0.3 }}
                      transition={{ delay: 0.8 + i * 0.05, duration: 0.3 }}
                      className="h-0.5 bg-amber-900/30 rounded origin-left"
                      style={{ width: `${70 + Math.random() * 25}%` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Front Cover - Opens like a book */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary-foreground/25 to-primary-foreground/10 rounded-r-md rounded-l-sm border border-primary-foreground/30 shadow-xl"
            style={{ 
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden'
            }}
            animate={{
              rotateY: animationPhase === 'closed' ? 0 : animationPhase === 'opening' ? -120 : -150,
            }}
            transition={{ 
              duration: animationPhase === 'opening' ? 0.8 : 0.4, 
              ease: 'easeInOut' 
            }}
          >
            {/* Cover decoration */}
            <div className="absolute inset-3 border-2 border-primary-foreground/20 rounded flex flex-col items-center justify-center">
              {/* Decorative top ornament */}
              <motion.div 
                className="w-12 h-0.5 bg-gradient-to-r from-transparent via-primary-foreground/40 to-transparent mb-4"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              />
              
              {/* Book icon/emblem */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="relative"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-12 h-12 text-primary-foreground/60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </motion.div>

              {/* Decorative bottom ornament */}
              <motion.div 
                className="w-8 h-0.5 bg-gradient-to-r from-transparent via-primary-foreground/40 to-transparent mt-4"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Title - appears after book opens */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: animationPhase === 'open' ? 1 : 0, 
            y: animationPhase === 'open' ? 0 : 20 
          }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 text-center"
        >
          <h1 className="font-display text-2xl font-semibold text-primary-foreground tracking-wide">
            SecureReader
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/60 font-body italic">
            Your Protected Digital Library
          </p>
        </motion.div>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: animationPhase === 'open' ? 1 : 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-8"
        >
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary-foreground/40"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
