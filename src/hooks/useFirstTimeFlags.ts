/**
 * Track first-time events for tutorials/onboarding.
 * Uses localStorage (or Capacitor Preferences on native).
 */
import { useState, useEffect, useCallback } from 'react';

const FLAGS = {
  APP_OPENED: 'ft_app_opened',
  READER_OPENED: 'ft_reader_opened',
  DOWNLOAD_HINT_SHOWN: 'ft_download_hint',
} as const;

function getFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // ignore
  }
}

export function useFirstTimeFlags() {
  const [isFirstAppOpen, setIsFirstAppOpen] = useState(false);
  const [isFirstReaderOpen, setIsFirstReaderOpen] = useState(false);
  const [showDownloadHint, setShowDownloadHint] = useState(false);

  useEffect(() => {
    if (!getFlag(FLAGS.APP_OPENED)) {
      setIsFirstAppOpen(true);
    }
    if (!getFlag(FLAGS.READER_OPENED)) {
      setIsFirstReaderOpen(true);
    }
    if (!getFlag(FLAGS.DOWNLOAD_HINT_SHOWN)) {
      setShowDownloadHint(true);
    }
  }, []);

  const markAppOpened = useCallback(() => {
    setFlag(FLAGS.APP_OPENED);
    setIsFirstAppOpen(false);
  }, []);

  const markReaderOpened = useCallback(() => {
    setFlag(FLAGS.READER_OPENED);
    setIsFirstReaderOpen(false);
  }, []);

  const markDownloadHintShown = useCallback(() => {
    setFlag(FLAGS.DOWNLOAD_HINT_SHOWN);
    setShowDownloadHint(false);
  }, []);

  return {
    isFirstAppOpen,
    isFirstReaderOpen,
    showDownloadHint,
    markAppOpened,
    markReaderOpened,
    markDownloadHintShown,
  };
}
