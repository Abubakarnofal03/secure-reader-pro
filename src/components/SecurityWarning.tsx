import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Camera, Video } from 'lucide-react';

interface SecurityWarningProps {
  isRecording: boolean;
  screenshotDetected: boolean;
  onDismiss?: () => void;
}

/**
 * Security warning overlay displayed when screen recording is active
 * or when a screenshot is detected (iOS only)
 */
export function SecurityWarning({
  isRecording,
  screenshotDetected,
  onDismiss,
}: SecurityWarningProps) {
  if (!isRecording && !screenshotDetected) {
    return null;
  }

  return (
    <AnimatePresence>
      {/* Full screen overlay when recording */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          <Video className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-xl font-bold text-destructive mb-2">
            Screen Recording Detected
          </h2>
          <p className="text-center text-muted-foreground max-w-xs">
            Content is hidden while screen recording is active.
            Please stop recording to continue reading.
          </p>
        </motion.div>
      )}

      {/* Screenshot notification (iOS) */}
      {screenshotDetected && !isRecording && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          onClick={onDismiss}
          className="fixed top-4 left-4 right-4 z-[100] p-4 rounded-xl bg-destructive text-destructive-foreground shadow-lg safe-top"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-destructive-foreground/10">
              <Camera className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Screenshot Detected</p>
              <p className="text-sm opacity-90">
                This content is watermarked and traceable to your account.
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
