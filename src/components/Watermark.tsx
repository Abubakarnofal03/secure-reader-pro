import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

interface WatermarkProps {
  className?: string;
  sessionId?: string;
}

export function Watermark({ className = '', sessionId }: WatermarkProps) {
  const { profile } = useAuth();

  const watermarkLines = useMemo(() => {
    if (!profile) return [];

    const userName = profile.name || profile.email.split('@')[0];
    const timestamp = new Date().toLocaleString();
    const session = sessionId || crypto.randomUUID().substring(0, 8);

    // Create multiple lines for better coverage
    return [
      `${userName}`,
      `${profile.email}`,
      `ID: ${profile.id.substring(0, 8)}`,
      `${timestamp}`,
      `Session: ${session}`,
    ];
  }, [profile, sessionId]);

  if (!profile) return null;

  // Create a grid of watermarks for comprehensive coverage
  const rows = 8;
  const cols = 3;

  return (
    <div 
      className={`watermark-overlay absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      style={{ 
        zIndex: 100,
        touchAction: 'auto',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {/* Primary diagonal watermark grid */}
      <div 
        className="absolute inset-0"
        style={{
          transform: 'rotate(-25deg) scale(1.5)',
          transformOrigin: 'center center',
        }}
      >
        <div 
          className="grid gap-16 p-8"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            minHeight: '200%',
            minWidth: '200%',
            marginLeft: '-50%',
            marginTop: '-50%',
          }}
        >
          {Array.from({ length: rows * cols }).map((_, index) => (
            <div 
              key={index}
              className="flex flex-col items-center justify-center gap-0.5 text-center"
            >
              {watermarkLines.map((line, lineIdx) => (
                <span
                  key={lineIdx}
                  className="whitespace-nowrap text-watermark font-semibold tracking-wide"
                  style={{
                    fontSize: lineIdx === 0 ? '0.7rem' : '0.55rem',
                    opacity: lineIdx === 0 ? 0.18 : 0.12,
                    textShadow: '0 0 1px hsl(var(--foreground) / 0.1)',
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Secondary subtle pattern for added security */}
      <div 
        className="absolute inset-0"
        style={{
          transform: 'rotate(25deg) scale(1.3)',
          transformOrigin: 'center center',
          opacity: 0.06,
        }}
      >
        <div className="flex flex-wrap gap-20 p-4 justify-center">
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-foreground text-xs font-bold"
            >
              {profile.email}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
