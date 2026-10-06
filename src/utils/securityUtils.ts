/**
 * FinanList Security Utilities
 * Implements PBKDF2 with SHA-256 for PIN hashing and progressive lockout.
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/**
 * Converts a Uint8Array buffer into a hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hexadecimal string into a Uint8Array buffer.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generates a cryptographically secure random salt in hex representation.
 */
export function generateSalt(byteLength: number = SALT_BYTES): string {
  const array = new Uint8Array(byteLength);
  const cryptoObj = typeof window !== 'undefined' ? (window.crypto || (window as any).msCrypto) : globalThis.crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    cryptoObj.getRandomValues(array);
  } else {
    for (let i = 0; i < byteLength; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(array);
}

/**
 * Derives a PBKDF2-HMAC-SHA256 hash for a given 4-digit PIN and salt.
 * Returns the standardized string format: `pbkdf2$<saltHex>$<hashHex>`.
 */
export async function hashPin(
  pin: string,
  saltHex?: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<string> {
  const salt = saltHex || generateSalt();
  const enc = new TextEncoder();
  const cryptoObj = typeof window !== 'undefined' ? (window.crypto || (window as any).msCrypto) : globalThis.crypto;

  if (cryptoObj && cryptoObj.subtle) {
    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      enc.encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const saltBytes = hexToBytes(salt);
    const derivedBits = await cryptoObj.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      HASH_BYTES * 8
    );

    const hashHex = bytesToHex(new Uint8Array(derivedBits));
    return `pbkdf2$${salt}$${hashHex}`;
  }

  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
}

/**
 * Checks if a stored PIN is in legacy plaintext format (e.g., raw "1234" or not starting with "pbkdf2$" or "sha256$").
 */
export function isLegacyPlaintextPin(storedPin?: string): boolean {
  if (!storedPin) return false;
  return !storedPin.startsWith('pbkdf2$') && !storedPin.startsWith('sha256$');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies an input PIN against the stored PIN value.
 * Seamlessly validates legacy plaintext PINs, modern SHA-256 hashes, and PBKDF2 hashes.
 */
export async function verifyPin(inputPin: string, storedPin: string): Promise<boolean> {
  if (!inputPin || !storedPin) return false;

  // Legacy plaintext support (e.g. "1234", "0000")
  if (isLegacyPlaintextPin(storedPin)) {
    return constantTimeEquals(inputPin, storedPin);
  }

  // Modern SHA-256 format: sha256$<saltHex>$<hashHex>
  if (storedPin.startsWith('sha256$')) {
    const { CryptoService } = await import('../services/CryptoService');
    return CryptoService.verifyPin(inputPin, storedPin);
  }

  // PBKDF2 format: pbkdf2$<saltHex>$<hashHex>
  const parts = storedPin.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const salt = parts[1];
  const expectedHash = parts[2];

  try {
    const computedFull = await hashPin(inputPin, salt, PBKDF2_ITERATIONS);
    const computedHash = computedFull.split('$')[2];
    return constantTimeEquals(computedHash, expectedHash);
  } catch (e) {
    console.error('[Security] Error verifying PIN hash:', e);
    return false;
  }
}

// --- Progressive Lockout Mechanism ---
const LOCKOUT_STORAGE_KEY = 'finanlist_pin_lockout';

export interface LockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
}

interface StoredLockoutData {
  failedAttempts: number;
  lockUntil: number; // millisecond timestamp
}

let memoryLockoutStore: string | null = null;

function getStoredLockout(): StoredLockoutData {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCKOUT_STORAGE_KEY) : memoryLockoutStore;
    if (!raw) return { failedAttempts: 0, lockUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { failedAttempts: 0, lockUntil: 0 };
  }
}

function setStoredLockout(data: StoredLockoutData): void {
  try {
    const serialized = JSON.stringify(data);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCKOUT_STORAGE_KEY, serialized);
    }
    memoryLockoutStore = serialized;
  } catch (e) {
    console.error('[Security] Could not persist lockout data', e);
  }
}

/**
 * Checks if the user is currently locked out from entering their PIN.
 */
export function checkPinLockout(): LockoutState {
  const data = getStoredLockout();
  const now = Date.now();
  if (data.lockUntil > now) {
    const remainingSeconds = Math.ceil((data.lockUntil - now) / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      failedAttempts: data.failedAttempts
    };
  }
  return {
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: data.failedAttempts
  };
}

/**
 * Records a failed PIN attempt and triggers progressive lockout:
 * - 3 to 4 failed attempts: 30 seconds lockout.
 * - 5 or more failed attempts: 300 seconds (5 minutes) lockout.
 */
export function recordFailedPinAttempt(): LockoutState {
  const data = getStoredLockout();
  const newAttempts = (data.failedAttempts || 0) + 1;
  const now = Date.now();
  let lockDurationMs = 0;

  if (newAttempts >= 5) {
    lockDurationMs = 300 * 1000; // 5 minutes
  } else if (newAttempts >= 3) {
    lockDurationMs = 30 * 1000;  // 30 seconds
  }

  const updatedData: StoredLockoutData = {
    failedAttempts: newAttempts,
    lockUntil: lockDurationMs > 0 ? now + lockDurationMs : 0
  };

  setStoredLockout(updatedData);

  return {
    isLocked: lockDurationMs > 0,
    remainingSeconds: Math.ceil(lockDurationMs / 1000),
    failedAttempts: newAttempts
  };
}

/**
 * Resets failed attempts and unlocks PIN entry after successful authentication.
 */
export function resetPinLockout(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    }
    memoryLockoutStore = null;
  } catch (e) {
    console.error('[Security] Could not reset lockout data', e);
  }
}
