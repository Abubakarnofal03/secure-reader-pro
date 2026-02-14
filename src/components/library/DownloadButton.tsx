import { useState, useCallback } from 'react';
import { Download, CheckCircle, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';

interface DownloadButtonProps {
  contentId: string;
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadingContentId: string | null;
  downloadProgress: number;
  onDownload: () => void;
  onRemove: () => void;
}

export function DownloadButton({
  contentId,
  isDownloaded,
  isDownloading,
  downloadingContentId,
  downloadProgress,
  onDownload,
  onRemove,
}: DownloadButtonProps) {
  const [showRemove, setShowRemove] = useState(false);
  const isThisDownloading = isDownloading && downloadingContentId === contentId;

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (isThisDownloading) return;

      if (isDownloaded) {
        setShowRemove((prev) => !prev);
        return;
      }

      onDownload();
    },
    [isThisDownloading, isDownloaded, onDownload],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setShowRemove(false);
      onRemove();
    },
    [onRemove],
  );

  // Don't render on web
  if (!Capacitor.isNativePlatform()) return null;

  // Downloading state: show progress ring
  if (isThisDownloading) {
    const circumference = 2 * Math.PI * 12;
    const strokeDashoffset = circumference - (downloadProgress / 100) * circumference;

    return (
      <div
        className="flex-shrink-0 flex items-center justify-center w-10 h-10"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      >
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="2" />
            <circle
              cx="14" cy="14" r="12" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-foreground">
            {downloadProgress}%
          </span>
        </div>
      </div>
    );
  }

  // Downloaded state
  if (isDownloaded) {
    return (
      <div className="flex-shrink-0 flex items-center gap-1">
        <AnimatePresence>
          {showRemove && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 10 }}
              transition={{ duration: 0.15 }}
              onClick={handleRemove}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 text-destructive active:scale-95 transition-transform"
              aria-label="Remove download"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <button
          onClick={handleClick}
          className="flex items-center justify-center w-10 h-10 rounded-full text-success active:scale-95 transition-transform"
          aria-label="Downloaded (tap to manage)"
        >
          <CheckCircle className="h-5 w-5" />
        </button>
      </div>
    );
  }

  // Not downloaded
  return (
    <button
      onClick={handleClick}
      disabled={isDownloading}
      className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-primary active:scale-95 transition-all disabled:opacity-40"
      aria-label="Download for offline reading"
    >
      <Download className="h-5 w-5" />
    </button>
  );
}
