import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [phase, setPhase] = useState<'enter' | 'opening' | 'zoom' | 'exit'>('enter');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('opening'), 400),
      setTimeout(() => setPhase('zoom'), 1800),
      setTimeout(() => setPhase('exit'), 2500),
      setTimeout(() => setShowSplash(false), 2900),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!showSplash && !loading) {
      if (user && profile) {
        navigate(profile.role === 'admin' ? '/admin' : '/library', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [showSplash, loading, user, profile, navigate]);

  // Calculate animation values based on phase
  const isOpening = phase === 'opening' || phase === 'zoom' || phase === 'exit';
  const isZooming = phase === 'zoom' || phase === 'exit';
  const isExiting = phase === 'exit';

  return (
    <motion.div 
      className="fixed inset-0 flex items-center justify-center bg-primary overflow-hidden z-50"
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary-foreground)/0.08)_0%,_transparent_60%)]" />

      {/* Book + Content container - handles the zoom */}
      <motion.div
        className="relative flex flex-col items-center will-change-transform"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ 
          scale: isZooming ? 8 : 1,
          opacity: isZooming ? 0 : 1,
        }}
        transition={{ 
          scale: { duration: 0.7, ease: [0.32, 0, 0.67, 0] },
          opacity: { duration: 0.5, ease: 'easeOut' },
        }}
      >
        {/* Book */}
        <div 
          className="relative w-28 h-40 will-change-transform"
          style={{ perspective: '800px', perspectiveOrigin: 'center center' }}
        >
          {/* Shadow */}
          <motion.div 
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-3 bg-black/25 blur-lg rounded-full"
            animate={{ opacity: isOpening ? 0.4 : 0.6, scale: isOpening ? 1.1 : 1 }}
            transition={{ duration: 0.6 }}
          />

          {/* Back cover + pages */}
          <div className="absolute inset-0 rounded-r-md bg-gradient-to-br from-[hsl(222_47%_16%)] to-[hsl(222_47%_10%)] border border-gold/20">
            {/* Spine */}
            <div className="absolute left-0 top-0 w-2.5 h-full bg-gradient-to-r from-gold/50 to-gold/30 rounded-l-sm" />
            {/* Page edges */}
            <motion.div 
              className="absolute top-1 bottom-1 right-0 w-1 bg-gradient-to-b from-amber-50/90 via-amber-100/80 to-amber-50/90 rounded-r-sm origin-left"
              animate={{ scaleX: isOpening ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            />
          </div>

          {/* Inner pages (visible when open) */}
          <motion.div
            className="absolute top-1 bottom-1 left-3 right-1 bg-gradient-to-r from-amber-50/95 to-amber-100/90 rounded-r origin-left overflow-hidden"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ 
              scaleX: isOpening ? 1 : 0,
              opacity: isOpening ? 1 : 0,
            }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          >
            {/* Logo on page */}
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: isOpening ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <img 
                src={logo} 
                alt="MyCalorics" 
                className="w-20 h-20 object-contain opacity-70"
              />
            </motion.div>
          </motion.div>

          {/* Front cover - opens with 3D rotation */}
          <motion.div
            className="absolute inset-0 rounded-r-md overflow-hidden will-change-transform"
            style={{ 
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
            }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: isOpening ? -140 : 0 }}
            transition={{ 
              duration: 0.8, 
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {/* Cover background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222_47%_18%)] via-[hsl(222_47%_14%)] to-[hsl(222_47%_10%)] border border-gold/30">
              {/* Spine edge */}
              <div className="absolute left-0 top-0 w-2.5 h-full bg-gradient-to-r from-gold/60 to-gold/40" />
              
              {/* Inner decorative frame */}
              <div className="absolute inset-3 border border-gold/25 rounded-sm">
                {/* Corner accents */}
                <div className="absolute -top-px -left-px w-3 h-3 border-t border-l border-gold/50" />
                <div className="absolute -top-px -right-px w-3 h-3 border-t border-r border-gold/50" />
                <div className="absolute -bottom-px -left-px w-3 h-3 border-b border-l border-gold/50" />
                <div className="absolute -bottom-px -right-px w-3 h-3 border-b border-r border-gold/50" />
              </div>

              {/* Center logo */}
              <div className="absolute inset-0 flex items-center justify-center p-2">
                <img 
                  src={logo} 
                  alt="MyCalorics" 
                  className="w-20 h-20 object-contain"
                />
              </div>

              {/* Decorative lines */}
              <div className="absolute top-5 left-5 right-5 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            </div>

            {/* Shine sweep */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12"
              initial={{ x: '-150%' }}
              animate={{ x: isOpening ? '250%' : '-150%' }}
              transition={{ duration: 1.2, delay: 0.2, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>

        {/* Title */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ 
            opacity: phase === 'opening' ? 1 : 0,
            y: phase === 'opening' ? 0 : 16,
          }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <h1 className="font-display text-xl font-semibold text-primary-foreground tracking-wide">
            SecureReader
          </h1>
          <p className="mt-1.5 text-xs text-primary-foreground/50 italic">
            Your Protected Digital Library
          </p>
        </motion.div>

        {/* Loading dots */}
        <motion.div
          className="mt-6 flex gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'opening' ? 1 : 0 }}
          transition={{ delay: 0.7 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gold/50"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Fade overlay */}
      <motion.div
        className="absolute inset-0 bg-background pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  );
}
