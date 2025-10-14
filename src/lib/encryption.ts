// Client-side encryption utilities using Web Crypto API

/**
 * Derives an encryption key from user's email and a secret passphrase
 * This ensures the key is deterministic but never stored
 */
export async function deriveKey(email: string, passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(email + passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("photovault-salt-v1"), // Static salt for deterministic key
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a file using AES-GCM
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const fileData = await file.arrayBuffer();

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileData
  );

  return { encryptedData, iv };
}

/**
 * Decrypts data using AES-GCM
 */
export async function decryptData(
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  // Ensure iv is a proper Uint8Array with ArrayBuffer
  const ivBuffer = new Uint8Array(iv);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, key, encryptedData);
}

/**
 * Converts encrypted data and IV to a Blob for upload
 */
export function createEncryptedBlob(
  encryptedData: ArrayBuffer,
  iv: Uint8Array
): Blob {
  // Prepend IV to encrypted data for storage
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return new Blob([combined], { type: "application/octet-stream" });
}

/**
 * Extracts IV and encrypted data from stored blob
 */
export async function extractFromBlob(
  blob: Blob
): Promise<{ iv: Uint8Array; encryptedData: ArrayBuffer }> {
  const arrayBuffer = await blob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const iv = new Uint8Array(data.subarray(0, 12)); // First 12 bytes are IV
  const encryptedDataView = data.subarray(12); // Rest is encrypted data
  
  // Copy to a new ArrayBuffer to ensure proper type
  const encryptedData = encryptedDataView.buffer.slice(
    encryptedDataView.byteOffset,
    encryptedDataView.byteOffset + encryptedDataView.byteLength
  );
  
  return { iv, encryptedData };
}
