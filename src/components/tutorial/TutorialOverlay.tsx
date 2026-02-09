import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, ShoppingBag, Newspaper, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const PHASE1_STEPS: TutorialStep[] = [
  {
    icon: <Library className="h-10 w-10" />,
    title: 'Your Library',
    description: 'All your purchased publications appear here. Tap any book to start reading instantly.',
    color: 'bg-primary',
  },
  {
    icon: <ShoppingBag className="h-10 w-10" />,
    title: 'Browse the Store',
    description: 'Discover new publications and purchase them by uploading your payment proof.',
    color: 'bg-[hsl(30_25%_62%)]',
  },
  {
    icon: <Newspaper className="h-10 w-10" />,
    title: 'Stay Updated',
    description: 'Check the Updates tab for the latest news, highlights, and announcements.',
    color: 'bg-[hsl(100_30%_50%)]',
  },
];

interface TutorialOverlayProps {
  onComplete: () => void;
}

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = PHASE1_STEPS[currentStep];
  const isLast = currentStep === PHASE1_STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 backdrop-blur-md safe-top safe-bottom"
    >
      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        Skip
        <X className="h-4 w-4" />
      </button>

      {/* Step indicators */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {PHASE1_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
            }`}
          />
        ))}
      </div>

      <div className="flex flex-col items-center px-8 max-w-sm text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            {/* Icon */}
            <div className={`flex h-24 w-24 items-center justify-center rounded-3xl ${step.color} text-white shadow-lg mb-8`}>
              {step.icon}
            </div>

            {/* Title */}
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-muted-foreground leading-relaxed text-base">
              {step.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-10 w-full">
          {!isFirst && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentStep(s => s - 1)}
              className="rounded-xl flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button
            size="lg"
            onClick={() => {
              if (isLast) {
                onComplete();
              } else {
                setCurrentStep(s => s + 1);
              }
            }}
            className="rounded-xl flex-1"
          >
            {isLast ? "Let's Go!" : 'Next'}
            {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
