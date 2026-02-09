import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, StickyNote, Highlighter, ZoomIn, 
  X, ChevronRight, ChevronLeft, BookOpen, Hand
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const READER_STEPS: TutorialStep[] = [
  {
    icon: <BookOpen className="h-9 w-9" />,
    title: 'Welcome to the Reader',
    description: 'Your secure reading environment. Scroll to read, and use the tools in the header for navigation.',
  },
  {
    icon: <Menu className="h-9 w-9" />,
    title: 'Table of Contents',
    description: 'Tap this icon to jump between chapters and sections instantly.',
  },
  {
    icon: <StickyNote className="h-9 w-9" />,
    title: 'Notes',
    description: 'Add personal notes to any page. They are saved to your account and available on any device.',
  },
  {
    icon: <Highlighter className="h-9 w-9" />,
    title: 'Highlights',
    description: 'Activate highlight mode to draw color-coded highlights on any page. Long-press a highlight to delete.',
  },
  {
    icon: <ZoomIn className="h-9 w-9" />,
    title: 'Zoom Controls',
    description: 'Use the zoom buttons on the right to enlarge text. The percentage shows your current zoom level.',
  },
  {
    icon: <Hand className="h-9 w-9" />,
    title: 'Quick Navigation',
    description: 'Tap the "Page X of Y" text below the title to jump to any page or revisit recent pages.',
  },
];

interface ReaderTutorialOverlayProps {
  onComplete: () => void;
}

export function ReaderTutorialOverlay({ onComplete }: ReaderTutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = READER_STEPS[currentStep];
  const isLast = currentStep === READER_STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 backdrop-blur-md safe-top safe-bottom"
    >
      {/* Skip */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        Skip
        <X className="h-4 w-4" />
      </button>

      {/* Step indicators */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {READER_STEPS.map((_, i) => (
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
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-8">
              {step.icon}
            </div>

            <h2 className="font-display text-2xl font-bold text-foreground mb-3">
              {step.title}
            </h2>

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
            {isLast ? 'Start Reading' : 'Next'}
            {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
