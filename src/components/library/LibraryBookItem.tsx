import { ChevronRight, CheckCircle, Clock, BookOpen, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCategoryConfig } from '@/lib/categories';
import { formatPrice } from '@/lib/currency';

interface LibraryBookItemProps {
  id: string;
  title: string;
  coverUrl?: string | null;
  category?: string | null;
  price: number;
  currency: string;
  status: 'purchased' | 'pending' | 'rejected' | null;
  progress?: number; // 0-100
  lastAccessed?: string;
  onClick: () => void;
  index: number;
  showInMyBooks?: boolean;
}

export function LibraryBookItem({
  title,
  coverUrl,
  category,
  price,
  status,
  progress = 0,
  onClick,
  index,
  showInMyBooks = false,
}: LibraryBookItemProps) {
  const isPurchased = status === 'purchased';
  const isPending = status === 'pending';
  const isComplete = progress === 100;
  const isInProgress = progress > 0 && progress < 100;
  const isUnread = isPurchased && progress === 0;
  const categoryConfig = category ? getCategoryConfig(category) : null;

  const getStatusLabel = () => {
    if (showInMyBooks) {
      if (isComplete) return 'Completed';
      if (isInProgress) return 'In Progress';
      return 'Unread';
    }
    return categoryConfig?.label || 'Reference';
  };

  const getCategoryLabel = () => {
    return categoryConfig?.label || 'Reference';
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={onClick}
      disabled={isPending}
      className={`group w-full flex items-center gap-4 p-4 rounded-xl bg-card border text-left transition-all duration-200 active:scale-[0.99] ${
        isPending
          ? 'opacity-60 cursor-not-allowed border-border/40'
          : 'border-border/50 hover:border-primary/30 hover:shadow-sm'
      }`}
    >
      {/* Book Cover / Icon */}
      <div className="relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-primary to-primary/80 border border-primary/30 shadow-md">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`${title} cover`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center">
            {/* Book spine effect */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-foreground/20" />
            
            {/* Category icon or book icon */}
            {categoryConfig && categoryConfig.id !== 'general' ? (
              <categoryConfig.icon className="h-8 w-8 text-primary-foreground/90" />
            ) : (
              <BookOpen className="h-8 w-8 text-primary-foreground/90" />
            )}
          </div>
        )}

        {/* Progress ring overlay for in-progress items */}
        {showInMyBooks && isInProgress && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[2px]">
            <div className="relative w-12 h-12">
              {/* Background circle */}
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 0.88} 88`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
                {progress}%
              </span>
            </div>
          </div>
        )}

        {/* Unread badge */}
        {showInMyBooks && isUnread && (
          <div className="absolute top-1 right-1">
            <FileText className="h-4 w-4 text-primary-foreground/80" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold text-foreground leading-snug line-clamp-2">
          {title}
        </h3>
        
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {showInMyBooks ? (
            <>
              <span className="text-sm text-muted-foreground">
                {getCategoryLabel()}
              </span>
              <span className="text-muted-foreground/50">•</span>
              {isComplete ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/15 text-success">
                  COMPLETED
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {getStatusLabel()}
                </span>
              )}
            </>
          ) : (
            <>
              {status === 'purchased' ? (
                <span className="inline-flex items-center gap-1 text-sm text-success font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Owned
                </span>
              ) : status === 'pending' ? (
                <span className="inline-flex items-center gap-1 text-sm text-warning font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  Pending Approval
                </span>
              ) : status === 'rejected' ? (
                <span className="text-sm text-destructive font-medium">
                  Rejected
                </span>
              ) : (
                <span className="text-sm font-semibold text-primary">
                  {formatPrice(price)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className={`h-5 w-5 flex-shrink-0 transition-colors ${
        isPurchased ? 'text-muted-foreground' : 'text-muted-foreground/40'
      }`} />
    </motion.button>
  );
}
