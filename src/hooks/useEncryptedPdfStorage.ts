import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getDeviceId } from '@/lib/device';

interface CachedMeta {
  versionHash: string;
  contentId: string;
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

export function useEncryptedPdfStorage(userId: string | undefined) {
  const metaCacheRef = useRef<Map<string, CachedMeta>>(new Map());

  const getFileName = useCallback((contentId: string, versionHash: string) => {
    return `${contentId}_${versionHash}.enc`;
  }, []);

  const getMetaFileName = useCallback((contentId: string) => {
    return `${contentId}_meta.json`;
  }, []);

  /**
   * Check if we have a cached version that matches the given hash.
   */
  const hasCachedVersion = useCallback(async (
    contentId: string,
    versionHash: string,
  ): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const metaFile = getMetaFileName(contentId);
      const result = await Filesystem.readFile({
        path: metaFile,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const meta: CachedMeta = JSON.parse(result.data as string);
      metaCacheRef.current.set(contentId, meta);
      return meta.versionHash === versionHash;
    } catch {
      return false;
    }
  }, [getMetaFileName]);

  /**
   * Save encrypted PDF bytes to app-private storage.
   */
  const saveEncryptedPdf = useCallback(async (
    contentId: string,
    versionHash: string,
    encryptedBase64: string,
  ): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;

    const fileName = getFileName(contentId, versionHash);

    // Write encrypted file
    await Filesystem.writeFile({
      path: fileName,
      data: encryptedBase64,
      directory: Directory.Data,
    });

    // Write meta
    const meta: CachedMeta = { versionHash, contentId };
    await Filesystem.writeFile({
      path: getMetaFileName(contentId),
      data: JSON.stringify(meta),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    metaCacheRef.current.set(contentId, meta);

    // Clean up old versions
    try {
      const listing = await Filesystem.readdir({
        path: '',
        directory: Directory.Data,
      });
      for (const file of listing.files) {
        if (
          file.name.startsWith(contentId) &&
          file.name.endsWith('.enc') &&
          file.name !== fileName
        ) {
          await Filesystem.deleteFile({
            path: file.name,
            directory: Directory.Data,
          });
        }
      }
    } catch {
      // Cleanup is best-effort
    }
  }, [getFileName, getMetaFileName]);

  /**
   * Decrypt in memory and return raw PDF bytes. Never written to disk decrypted.
   */
  const getDecryptedPdf = useCallback(async (
    contentId: string,
    ivBase64: string,
    saltBase64: string,
  ): Promise<Uint8Array | null> => {
    if (!userId) return null;

    const deviceId = await getDeviceId();
    const password = `${userId}:${deviceId}:${contentId}`;
    const iv = fromBase64(ivBase64);
    const salt = fromBase64(saltBase64);

    let encryptedData: Uint8Array;

    if (Capacitor.isNativePlatform()) {
      // Read from device storage
      const meta = metaCacheRef.current.get(contentId);
      if (!meta) return null;

      const fileName = getFileName(contentId, meta.versionHash);
      const result = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Data,
      });
      encryptedData = fromBase64(result.data as string);
    } else {
      // Web fallback: encrypted data must be passed directly (no persistent storage)
      return null;
    }

    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encryptedData as BufferSource,
    );

    return new Uint8Array(decrypted);
  }, [userId, getFileName]);

  /**
   * Web-only: decrypt from base64 data directly (no filesystem).
   */
  const decryptFromBase64 = useCallback(async (
    contentId: string,
    encryptedBase64: string,
    ivBase64: string,
    saltBase64: string,
  ): Promise<Uint8Array> => {
    const deviceId = await getDeviceId();
    const password = `${userId}:${deviceId}:${contentId}`;
    const iv = fromBase64(ivBase64);
    const salt = fromBase64(saltBase64);
    const encryptedData = fromBase64(encryptedBase64);

    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encryptedData as BufferSource,
    );
    return new Uint8Array(decrypted);
  }, [userId]);

  return {
    hasCachedVersion,
    saveEncryptedPdf,
    getDecryptedPdf,
    decryptFromBase64,
  };
}
