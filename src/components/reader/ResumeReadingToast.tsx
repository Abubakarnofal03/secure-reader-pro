import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResumeReadingToastProps {
  show: boolean;
  savedPage: number;
  totalPages: number;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss: () => void;
}

export function ResumeReadingToast({
  show,
  savedPage,
  totalPages,
  onResume,
  onStartOver,
  onDismiss,
}: ResumeReadingToastProps) {
  const progress = Math.round((savedPage / totalPages) * 100);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute top-16 left-4 right-4 z-40 mx-auto max-w-md"
        >
          <div className="bg-card border border-border rounded-xl shadow-lg p-4">
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground text-sm">
                  Continue reading?
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You were on page {savedPage} of {totalPages} ({progress}%)
                </p>

                {/* Progress bar */}
                <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={onResume}
                    className="flex-1 h-8 text-xs"
                  >
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onStartOver}
                    className="flex-1 h-8 text-xs"
                  >
                    Start over
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
