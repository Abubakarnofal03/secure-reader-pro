import { CheckCircle } from 'lucide-react';
import { getCategoryConfig } from '@/lib/categories';
import logo from '@/assets/logo.png';

interface BookCoverProps {
  coverUrl?: string | null;
  title: string;
  isOwned?: boolean;
  progress?: number; // 0-100 percentage
  size?: 'sm' | 'md' | 'lg';
  category?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'h-14 w-10',
  md: 'h-20 w-14',
  lg: 'h-24 w-[68px]',
};

const logoSizes = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

export function BookCover({ coverUrl, title, isOwned = false, progress, size = 'md', category, className = '' }: BookCoverProps) {
  const showProgress = isOwned && typeof progress === 'number' && progress > 0 && progress < 100;
  const isComplete = isOwned && progress === 100;
  const categoryConfig = category ? getCategoryConfig(category) : null;

  return (
    <div 
      className={`relative flex-shrink-0 rounded-xl overflow-hidden ${sizeClasses[size]} ${className}`}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={`${title} cover`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div 
          className={`h-full w-full flex items-center justify-center ${
            isOwned 
              ? 'bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20' 
              : 'bg-gradient-to-br from-muted to-muted/50 border border-border/50'
          }`}
        >
          {/* Decorative lines for book spine effect */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-border/60 via-border/30 to-border/60" />
          <div className="absolute left-[5px] top-0 bottom-0 w-[1px] bg-border/20" />
          
          {/* Logo */}
          <img 
            src={logo} 
            alt="MyCalorics" 
            className={`${logoSizes[size]} object-contain opacity-70`}
          />
        </div>
      )}
      
      {/* Reading progress bar at bottom */}
      {showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
          <div 
            className="h-full bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(38_72%_55%)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Category icon badge - bottom left */}
      {categoryConfig && categoryConfig.id !== 'general' && (
        <div className="absolute bottom-1 left-1 h-5 w-5 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-sm border border-border/50">
          {(() => {
            const IconComponent = categoryConfig.icon;
            return <IconComponent className={`h-3 w-3 ${categoryConfig.color}`} />;
          })()}
        </div>
      )}

      {/* Completion badge or owned badge - top right */}
      {isComplete ? (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(152_70%_40%)] flex items-center justify-center shadow-[var(--shadow-sm)]">
          <CheckCircle className="h-3 w-3 text-white" />
        </div>
      ) : isOwned && !showProgress ? (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(38_72%_55%)] flex items-center justify-center shadow-[var(--shadow-gold)]">
          <CheckCircle className="h-3 w-3 text-[hsl(222_47%_11%)] dark:text-[hsl(0_0%_0%)]" />
        </div>
      ) : null}

      {/* Progress percentage label */}
      {showProgress && size !== 'sm' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
          <span className="text-[10px] font-medium text-white">{Math.round(progress)}%</span>
        </div>
      )}
      
      {/* Subtle overlay gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5 pointer-events-none" />
    </div>
  );
}
