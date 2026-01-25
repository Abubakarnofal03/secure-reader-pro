import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'visible' | 'zooming' | 'fading'>('initial');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Start visible phase
    const visibleTimer = setTimeout(() => {
      setAnimationPhase('visible');
    }, 100);

    // Start zoom effect
    const zoomTimer = setTimeout(() => {
      setAnimationPhase('zooming');
    }, 2000);

    // Start fade out
    const fadeTimer = setTimeout(() => {
      setAnimationPhase('fading');
    }, 2600);

    // End splash
    const endTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => {
      clearTimeout(visibleTimer);
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

  const isZooming = animationPhase === 'zooming' || animationPhase === 'fading';

  return (
    <motion.div 
      className="fixed inset-0 flex flex-col items-center justify-center bg-primary safe-top safe-bottom overflow-hidden z-50"
      animate={{
        opacity: animationPhase === 'fading' ? 0 : 1,
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-gradient-radial from-primary-foreground/5 via-transparent to-transparent" />

      {/* Main content container with zoom animation */}
      <motion.div 
        className="relative flex flex-col items-center"
        animate={{
          scale: isZooming ? 20 : 1,
          opacity: animationPhase === 'fading' ? 0 : 1,
        }}
        transition={{ 
          scale: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.3 }
        }}
      >
        {/* Premium Book Design */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1 
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative"
        >
          {/* Book container with 3D perspective */}
          <div className="relative w-32 h-44">
            {/* Book shadow */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black/20 blur-xl rounded-full" />
            
            {/* Book spine */}
            <div className="absolute left-0 top-0 w-3 h-full bg-gradient-to-r from-gold/60 to-gold/40 rounded-l-sm shadow-lg z-10">
              {/* Spine decorative lines */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gold-foreground/20 rounded-full" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gold-foreground/20 rounded-full" />
            </div>
            
            {/* Book cover */}
            <motion.div 
              className="absolute left-3 top-0 right-0 h-full rounded-r-md overflow-hidden"
              initial={{ rotateY: -5 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Main cover background - premium leather texture */}
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222_47%_18%)] via-[hsl(222_47%_14%)] to-[hsl(222_47%_10%)] border border-gold/30 rounded-r-md">
                {/* Inner border decoration */}
                <div className="absolute inset-2 border border-gold/20 rounded">
                  {/* Corner decorations */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-gold/40" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold/40" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-gold/40" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-gold/40" />
                </div>
                
                {/* Center emblem */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="relative"
                  >
                    {/* Gold emblem circle */}
                    <div className="w-16 h-16 rounded-full border-2 border-gold/50 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border border-gold/30 flex items-center justify-center bg-gold/10">
                        {/* Medical cross / book symbol */}
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-6 h-6 text-gold"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                          <path d="M12 6v7" />
                          <path d="M9 10h6" />
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                </div>
                
                {/* Top decorative line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="absolute top-6 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
                />
                
                {/* Bottom decorative line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="absolute bottom-6 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
                />
              </div>
              
              {/* Subtle shine effect */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ delay: 0.8, duration: 1.5, ease: 'easeInOut' }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
              />
            </motion.div>
            
            {/* Page edges visible on the right */}
            <div className="absolute right-0 top-1 bottom-1 w-1 bg-gradient-to-r from-amber-100/80 to-amber-50/60 rounded-r-sm">
              {/* Page line details */}
              <div className="absolute inset-0 flex flex-col justify-center gap-px opacity-50">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="h-px bg-amber-200/50" />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Title and tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: animationPhase !== 'initial' ? 1 : 0, 
            y: animationPhase !== 'initial' ? 0 : 20 
          }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10 text-center"
        >
          <h1 className="font-display text-2xl font-semibold text-primary-foreground tracking-wide">
            SecureReader
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/50 font-sans italic">
            Your Protected Digital Library
          </p>
        </motion.div>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: animationPhase === 'visible' ? 1 : 0 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="mt-8"
        >
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gold/60"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Background overlay that fades in during zoom */}
      <motion.div
        className="absolute inset-0 bg-background pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: animationPhase === 'zooming' ? 0.6 : animationPhase === 'fading' ? 1 : 0 
        }}
        transition={{ duration: 0.5 }}
      />
    </motion.div>
  );
}
