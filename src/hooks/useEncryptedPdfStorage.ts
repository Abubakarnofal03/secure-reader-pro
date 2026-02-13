import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getDeviceId } from '@/lib/device';
import type { OutlineItem } from '@/types/pdf';

// ── Types ──────────────────────────────────────────────────────────────────

interface SegmentMeta {
  segmentIndex: number;
  iv: string;   // base64
  salt: string;  // base64
  fileName: string;
}

export interface CachedContentMeta {
  versionHash: string;
  contentId: string;
  userId: string;
  title: string;
  totalPages: number;
  tableOfContents: OutlineItem[] | null;
  segments: SegmentMeta[];
}

// ── Crypto helpers ─────────────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────────────

const META_DIR = 'encrypted_content';

function metaPath(contentId: string) {
  return `${META_DIR}/${contentId}_meta.json`;
}

function segmentPath(contentId: string, versionHash: string, segmentIndex: number) {
  return `${META_DIR}/${contentId}_${versionHash}_seg${segmentIndex}.enc`;
}

// ── Ensure directory ───────────────────────────────────────────────────────

async function ensureDir() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.mkdir({
      path: META_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // Already exists
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useEncryptedPdfStorage() {
  const dirReady = useRef(false);

  const init = useCallback(async () => {
    if (!dirReady.current) {
      await ensureDir();
      dirReady.current = true;
    }
  }, []);

  /**
   * Get stored metadata for a content item (checks if it was previously downloaded).
   */
  const getStoredContentMeta = useCallback(async (
    contentId: string,
  ): Promise<CachedContentMeta | null> => {
    if (!Capacitor.isNativePlatform()) return null;
    await init();
    try {
      const result = await Filesystem.readFile({
        path: metaPath(contentId),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(result.data as string) as CachedContentMeta;
    } catch {
      return null;
    }
  }, [init]);

  /**
   * Save a single encrypted segment to device storage.
   */
  const saveSegment = useCallback(async (
    contentId: string,
    versionHash: string,
    segmentIndex: number,
    encryptedBase64: string,
  ): Promise<string> => {
    if (!Capacitor.isNativePlatform()) return '';
    await init();
    const path = segmentPath(contentId, versionHash, segmentIndex);
    await Filesystem.writeFile({
      path,
      data: encryptedBase64,
      directory: Directory.Data,
    });
    return path;
  }, [init]);

  /**
   * Save the full content metadata after all segments are downloaded.
   */
  const saveContentMeta = useCallback(async (
    meta: CachedContentMeta,
  ): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await init();
    await Filesystem.writeFile({
      path: metaPath(meta.contentId),
      data: JSON.stringify(meta),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }, [init]);

  /**
   * Read all segments from disk, decrypt each using stored IV/salt, return merged bytes.
   * userId is read from stored metadata (works when logged out).
   */
  const getDecryptedPdf = useCallback(async (
    contentId: string,
  ): Promise<Uint8Array | null> => {
    if (!Capacitor.isNativePlatform()) return null;

    const meta = await getStoredContentMeta(contentId);
    if (!meta || meta.segments.length === 0) return null;

    const deviceId = await getDeviceId();
    const password = `${meta.userId}:${deviceId}:${contentId}`;

    const decryptedParts: Uint8Array[] = [];

    for (const seg of meta.segments) {
      const result = await Filesystem.readFile({
        path: seg.fileName,
        directory: Directory.Data,
      });

      const encryptedData = fromBase64(result.data as string);
      const iv = fromBase64(seg.iv);
      const salt = fromBase64(seg.salt);

      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        encryptedData as BufferSource,
      );
      decryptedParts.push(new Uint8Array(decrypted));
    }

    // Merge all parts
    if (decryptedParts.length === 1) return decryptedParts[0];

    const totalLen = decryptedParts.reduce((sum, p) => sum + p.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of decryptedParts) {
      merged.set(part, offset);
      offset += part.length;
    }
    return merged;
  }, [getStoredContentMeta]);

  /**
   * Web-only: decrypt from base64 data directly (no filesystem).
   */
  const decryptFromBase64 = useCallback(async (
    contentId: string,
    userId: string,
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
  }, []);

  /**
   * Delete all cached content for a given contentId (for access revocation).
   */
  const deleteContent = useCallback(async (contentId: string): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await init();

    // Read meta to find segment files
    const meta = await getStoredContentMeta(contentId);
    if (meta) {
      for (const seg of meta.segments) {
        try {
          await Filesystem.deleteFile({ path: seg.fileName, directory: Directory.Data });
        } catch { /* best effort */ }
      }
    }

    // Delete meta file
    try {
      await Filesystem.deleteFile({ path: metaPath(contentId), directory: Directory.Data });
    } catch { /* best effort */ }
  }, [init, getStoredContentMeta]);

  /**
   * List all downloaded content IDs (for offline library).
   */
  const listDownloadedContent = useCallback(async (): Promise<CachedContentMeta[]> => {
    if (!Capacitor.isNativePlatform()) return [];
    await init();

    try {
      const listing = await Filesystem.readdir({
        path: META_DIR,
        directory: Directory.Data,
      });

      const metas: CachedContentMeta[] = [];
      for (const file of listing.files) {
        if (file.name.endsWith('_meta.json')) {
          try {
            const result = await Filesystem.readFile({
              path: `${META_DIR}/${file.name}`,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            });
            metas.push(JSON.parse(result.data as string) as CachedContentMeta);
          } catch { /* skip corrupt files */ }
        }
      }
      return metas;
    } catch {
      return [];
    }
  }, [init]);

  /**
   * Clean up old version files when a new version is downloaded.
   */
  const cleanupOldVersions = useCallback(async (
    contentId: string,
    currentVersionHash: string,
  ): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await init();

    try {
      const listing = await Filesystem.readdir({
        path: META_DIR,
        directory: Directory.Data,
      });

      for (const file of listing.files) {
        if (
          file.name.startsWith(contentId) &&
          file.name.endsWith('.enc') &&
          !file.name.includes(currentVersionHash)
        ) {
          try {
            await Filesystem.deleteFile({
              path: `${META_DIR}/${file.name}`,
              directory: Directory.Data,
            });
          } catch { /* best effort */ }
        }
      }
    } catch { /* best effort */ }
  }, [init]);

  return {
    getStoredContentMeta,
    saveSegment,
    saveContentMeta,
    getDecryptedPdf,
    decryptFromBase64,
    deleteContent,
    listDownloadedContent,
    cleanupOldVersions,
  };
}
