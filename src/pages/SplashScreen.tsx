import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [animationPhase, setAnimationPhase] = useState<'closed' | 'opening' | 'open' | 'zooming' | 'fading'>('closed');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Start opening animation after a brief pause
    const openTimer = setTimeout(() => {
      setAnimationPhase('opening');
    }, 300);

    // Book fully open
    const fullyOpenTimer = setTimeout(() => {
      setAnimationPhase('open');
    }, 1000);

    // Start zoom in effect
    const zoomTimer = setTimeout(() => {
      setAnimationPhase('zooming');
    }, 1800);

    // Start fade out
    const fadeTimer = setTimeout(() => {
      setAnimationPhase('fading');
    }, 2400);

    // End splash
    const endTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(fullyOpenTimer);
      clearTimeout(zoomTimer);
      clearTimeout(fadeTimer);
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

  const isZoomingOrFading = animationPhase === 'zooming' || animationPhase === 'fading';

  return (
    <motion.div 
      className="fixed inset-0 flex flex-col items-center justify-center bg-primary safe-top safe-bottom overflow-hidden z-50"
      animate={{
        opacity: animationPhase === 'fading' ? 0 : 1,
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
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

      <motion.div 
        className="relative flex flex-col items-center"
        animate={{
          scale: isZoomingOrFading ? 15 : 1,
          y: isZoomingOrFading ? 0 : 0,
        }}
        transition={{ 
          duration: 0.6, 
          ease: [0.4, 0, 0.2, 1]
        }}
      >
        {/* Book Animation Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: isZoomingOrFading ? 0 : 1 
          }}
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
                    transition={{ delay: 0.6 + i * 0.05, duration: 0.3 }}
                    className="h-0.5 bg-amber-900/30 rounded origin-left"
                    style={{ width: `${70 + Math.random() * 25}%` }}
                  />
                ))}
              </div>
            </motion.div>
          )}

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
              duration: animationPhase === 'opening' ? 0.7 : 0.3, 
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
              
              {/* Medical caduceus icon */}
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
                  <path d="M12 2v20M12 2c-2 2-4 3-6 3 2 0 4 1 6 3-2-2-4-3-6-3 2 0 4-1 6-3z" />
                  <path d="M12 8c2-2 4-3 6-3-2 0-4 1-6 3 2 2 4 3 6 3-2 0-4-1-6-3z" />
                  <circle cx="12" cy="6" r="2" />
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
          transition={{ duration: 0.4, delay: 0.1 }}
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
          transition={{ delay: 0.3, duration: 0.3 }}
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
      </motion.div>

      {/* White overlay that fades in during zoom */}
      <motion.div
        className="absolute inset-0 bg-background pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: animationPhase === 'zooming' ? 0.5 : animationPhase === 'fading' ? 1 : 0 
        }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  );
}
