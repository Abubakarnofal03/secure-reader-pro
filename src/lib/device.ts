// Generate or retrieve a unique device ID for session management
import { storage } from './storage';

const DEVICE_ID_KEY = 'secure_reader_device_id';

// Cache the device ID in memory to avoid async calls on every access
let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  // Return cached value if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  let deviceId = await storage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a unique device ID
    deviceId = generateDeviceId();
    await storage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  cachedDeviceId = deviceId;
  return deviceId;
}

function generateDeviceId(): string {
  // Create a unique identifier combining random values and timestamp
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array, (num) => num.toString(16).padStart(8, '0')).join('');
  const timestamp = Date.now().toString(36);
  return `${randomPart}-${timestamp}`;
}

// Clear device ID (for testing or logout purposes)
export async function clearDeviceId(): Promise<void> {
  cachedDeviceId = null;
  await storage.removeItem(DEVICE_ID_KEY);
}
