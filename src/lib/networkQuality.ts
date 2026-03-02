/**
 * Network quality detection utility.
 * Classifies the current connection as 'offline', 'poor', or 'good'.
 * On poor connections the app should behave as if offline to avoid hangs.
 */

export type NetworkQuality = 'offline' | 'poor' | 'good';

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

/**
 * Synchronously estimate network quality using browser hints.
 * Falls back to 'good' when hints are unavailable (will be validated async).
 */
export function getNetworkQuality(): NetworkQuality {
  if (!navigator.onLine) return 'offline';

  const nav = navigator as NavigatorWithConnection;
  const conn = nav.connection;

  if (conn) {
    // Data-saver mode → treat as poor
    if (conn.saveData) return 'poor';

    // effectiveType: 'slow-2g', '2g', '3g', '4g'
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'poor';

    // Very low bandwidth (< 0.5 Mbps) or very high latency (> 2s RTT)
    if (typeof conn.downlink === 'number' && conn.downlink < 0.5) return 'poor';
    if (typeof conn.rtt === 'number' && conn.rtt > 2000) return 'poor';

    // 3g with very low bandwidth is also poor
    if (conn.effectiveType === '3g' && typeof conn.downlink === 'number' && conn.downlink < 0.7) return 'poor';
  }

  return 'good';
}

/**
 * Check if current network is usable for backend calls.
 * Returns true for 'good' connections only.
 */
export function isNetworkGood(): boolean {
  return getNetworkQuality() === 'good';
}

/**
 * Check if we should treat current connection as offline.
 * Returns true for both 'offline' and 'poor' connections.
 */
export function isEffectivelyOffline(): boolean {
  return getNetworkQuality() !== 'good';
}

/**
 * Wrap a promise with a timeout. If the promise doesn't resolve
 * within `ms` milliseconds, it rejects with a timeout error.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Subscribe to network quality changes. Calls the callback
 * whenever the connection type changes.
 * Returns an unsubscribe function.
 */
export function onNetworkQualityChange(callback: (quality: NetworkQuality) => void): () => void {
  let lastQuality = getNetworkQuality();

  const check = () => {
    const q = getNetworkQuality();
    if (q !== lastQuality) {
      lastQuality = q;
      callback(q);
    }
  };

  const handleOnline = () => check();
  const handleOffline = () => {
    lastQuality = 'offline';
    callback('offline');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen to connection change events if available
  const nav = navigator as NavigatorWithConnection;
  const conn = nav.connection;
  if (conn && 'addEventListener' in conn) {
    (conn as EventTarget).addEventListener('change', check);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (conn && 'removeEventListener' in conn) {
      (conn as EventTarget).removeEventListener('change', check);
    }
  };
}
