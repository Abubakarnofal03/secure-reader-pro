import { BookOpen, CheckCircle } from 'lucide-react';

interface BookCoverProps {
  coverUrl?: string | null;
  title: string;
  isOwned?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-16 w-12',
  md: 'h-24 w-18',
  lg: 'h-32 w-24',
};

const iconSizes = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
};

export function BookCover({ coverUrl, title, isOwned = false, size = 'md', className = '' }: BookCoverProps) {
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
          
          {/* Book icon */}
          <BookOpen className={`${iconSizes[size]} ${isOwned ? 'text-primary' : 'text-muted-foreground/70'}`} />
          
          {/* Subtle title initial for larger covers */}
          {size === 'lg' && title && (
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-display text-xs text-muted-foreground/50 uppercase tracking-wider">
              {title.charAt(0)}
            </span>
          )}
        </div>
      )}
      
      {/* Premium owned badge */}
      {isOwned && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] flex items-center justify-center shadow-[var(--shadow-gold)]">
          <CheckCircle className="h-3 w-3 text-[hsl(222_47%_11%)] dark:text-[hsl(0_0%_0%)]" />
        </div>
      )}
      
      {/* Subtle overlay gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5 pointer-events-none" />
    </div>
  );
}
