import { motion } from 'framer-motion';

interface ScrollProgressBarProps {
  currentPage: number;
  totalPages: number;
}

export function ScrollProgressBar({ currentPage, totalPages }: ScrollProgressBarProps) {
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  return (
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-secondary z-40">
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    </div>
  );
}
