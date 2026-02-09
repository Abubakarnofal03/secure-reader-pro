import { useState, useEffect, useCallback } from 'react';

const TUTORIAL_STORAGE_KEY = 'mycalorics_tutorial';

interface TutorialState {
  phase1Complete: boolean;
  phase2Complete: boolean;
}

function getTutorialState(): TutorialState {
  try {
    const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { phase1Complete: false, phase2Complete: false };
}

function saveTutorialState(state: TutorialState) {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
}

export function useTutorial() {
  const [state, setState] = useState<TutorialState>(getTutorialState);

  const completePhase1 = useCallback(() => {
    const next = { ...state, phase1Complete: true };
    setState(next);
    saveTutorialState(next);
  }, [state]);

  const completePhase2 = useCallback(() => {
    const next = { ...state, phase2Complete: true };
    setState(next);
    saveTutorialState(next);
  }, [state]);

  const shouldShowPhase1 = !state.phase1Complete;
  const shouldShowPhase2 = state.phase1Complete && !state.phase2Complete;

  const resetTutorial = useCallback(() => {
    const next = { phase1Complete: false, phase2Complete: false };
    setState(next);
    saveTutorialState(next);
  }, []);

  return {
    shouldShowPhase1,
    shouldShowPhase2,
    completePhase1,
    completePhase2,
    resetTutorial,
  };
}
