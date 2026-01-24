import { useState, useEffect } from 'react';

const TERMS_ACCEPTED_KEY = 'secure_reader_terms_accepted';
const TERMS_VERSION = '1.0'; // Increment this when terms change

export function useTermsAcceptance() {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(TERMS_ACCEPTED_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if the accepted version matches current version
        if (parsed.version === TERMS_VERSION) {
          setHasAcceptedTerms(true);
        } else {
          // Terms updated, need to re-accept
          setHasAcceptedTerms(false);
        }
      } catch {
        setHasAcceptedTerms(false);
      }
    } else {
      setHasAcceptedTerms(false);
    }
  }, []);

  const acceptTerms = () => {
    const data = {
      version: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    localStorage.setItem(TERMS_ACCEPTED_KEY, JSON.stringify(data));
    setHasAcceptedTerms(true);
  };

  const resetTerms = () => {
    localStorage.removeItem(TERMS_ACCEPTED_KEY);
    setHasAcceptedTerms(false);
  };

  return {
    hasAcceptedTerms,
    isLoading: hasAcceptedTerms === null,
    acceptTerms,
    resetTerms,
  };
}
