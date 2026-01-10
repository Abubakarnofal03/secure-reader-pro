import { useAuth } from '@/contexts/AuthContext';

interface WatermarkProps {
  className?: string;
}

export function Watermark({ className = '' }: WatermarkProps) {
  const { profile } = useAuth();

  if (!profile) return null;

  const watermarkText = `${profile.name || profile.email} • ${profile.email}`;

  return (
    <div 
      className={`watermark absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      style={{ zIndex: 50 }}
    >
      <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-12 rotate-[-30deg] scale-150">
        {Array.from({ length: 20 }).map((_, i) => (
          <span 
            key={i} 
            className="whitespace-nowrap text-xs font-medium tracking-wide"
            style={{ opacity: 0.15 }}
          >
            {watermarkText}
          </span>
        ))}
      </div>
    </div>
  );
}
