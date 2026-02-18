import { useState } from 'react';
import { X, Download, Highlighter, StickyNote, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const APP_STEPS: TutorialStep[] = [
  {
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    title: 'Welcome to Calorics',
    description: 'Browse and purchase publications from the Store tab. Your purchased books appear in the Library.',
  },
  {
    icon: <Download className="h-8 w-8 text-primary" />,
    title: 'Download for Offline',
    description: 'Tap the download icon on any purchased book to read it offline — even without internet.',
  },
  {
    icon: <Highlighter className="h-8 w-8 text-primary" />,
    title: 'Highlight Text',
    description: 'Use the highlight tool in the reader to mark important sections with different colors.',
  },
  {
    icon: <StickyNote className="h-8 w-8 text-primary" />,
    title: 'Take Notes',
    description: 'Add notes to any page. Access all your notes from the notes panel in the reader.',
  },
];

const READER_STEPS: TutorialStep[] = [
  {
    icon: <Highlighter className="h-8 w-8 text-primary" />,
    title: 'Highlight',
    description: 'Tap the highlighter icon to draw highlights on any page. Pick from multiple colors.',
  },
  {
    icon: <StickyNote className="h-8 w-8 text-primary" />,
    title: 'Notes',
    description: 'Tap the sticky note icon to add, view, and manage notes for each page.',
  },
  {
    icon: <Download className="h-8 w-8 text-primary" />,
    title: 'Download',
    description: 'Download publications from the library for faster loading and offline access.',
  },
];

interface OnboardingTutorialProps {
  type: 'app' | 'reader';
  onComplete: () => void;
}

export function OnboardingTutorial({ type, onComplete }: OnboardingTutorialProps) {
  const steps = type === 'app' ? APP_STEPS : READER_STEPS;
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const step = steps[currentStep];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
    >
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-xl"
      >
        <button
          onClick={onComplete}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            {step.icon}
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>

          <Button onClick={handleNext} className="w-full mt-2">
            {currentStep < steps.length - 1 ? 'Next' : 'Got it!'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
