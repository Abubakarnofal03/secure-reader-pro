// Generate or retrieve a unique device ID for session management
const DEVICE_ID_KEY = 'secure_reader_device_id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a unique device ID
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
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
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
}
