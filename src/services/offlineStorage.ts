/**
 * Offline storage service for downloaded PDF segments.
 * Uses Capacitor Filesystem on native platforms, falls back to no-op on web.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { NativeDownloader } from '@/plugins/NativeDownloaderPlugin';

const BASE_DIR = 'offline-content';

export interface OfflineContentMetadata {
  contentId: string;
  title: string;
  totalSegments: number;
  totalPages: number;
  downloadedAt: string;
  segments: {
    index: number;
    startPage: number;
    endPage: number;
    fileName: string;
  }[];
  watermark?: {
    userName: string;
    userEmail: string;
  };
  /** Stored table of contents for offline access */
  tableOfContents?: unknown;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function contentDir(contentId: string): string {
  return `${BASE_DIR}/${contentId}`;
}

function segmentFileName(segmentIndex: number): string {
  return `segment-${segmentIndex}.pdf`;
}

function metadataFileName(): string {
  return `metadata.json`;
}

/**
 * Ensure the directory for a content exists.
 */
async function ensureDir(contentId: string): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: contentDir(contentId),
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e: any) {
    // Directory may already exist
    if (!e.message?.includes('exists')) {
      throw e;
    }
  }
}

/**
 * Download a PDF segment from a signed URL and save it locally.
 * (Web/iOS fallback — uses fetch + base64 conversion)
 */
export async function downloadSegment(
  contentId: string,
  segmentIndex: number,
  signedUrl: string,
): Promise<void> {
  if (!isNative()) return;

  await ensureDir(contentId);

  // Fetch the PDF blob
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download segment ${segmentIndex}: ${response.statusText}`);
  }

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  await Filesystem.writeFile({
    path: `${contentDir(contentId)}/${segmentFileName(segmentIndex)}`,
    data: base64,
    directory: Directory.Data,
  });
}

/**
 * Download a PDF segment using the native HTTP stack (Android only).
 * Uses HttpURLConnection for full bandwidth utilization and direct file writing.
 */
export async function downloadSegmentNative(
  contentId: string,
  segmentIndex: number,
  signedUrl: string,
): Promise<void> {
  const filePath = `${contentDir(contentId)}/${segmentFileName(segmentIndex)}`;

  await NativeDownloader.downloadFile({
    url: signedUrl,
    filePath: filePath,
  });
}

/**
 * Auto-select the best download method:
 * - Android: use native HttpURLConnection for full bandwidth
 * - iOS/Web: use fetch() fallback
 */
export async function downloadSegmentAuto(
  contentId: string,
  segmentIndex: number,
  signedUrl: string,
): Promise<void> {
  if (Capacitor.getPlatform() === 'android') {
    await downloadSegmentNative(contentId, segmentIndex, signedUrl);
  } else {
    await downloadSegment(contentId, segmentIndex, signedUrl);
  }
}

/**
 * Save metadata for a downloaded content.
 */
export async function saveContentMetadata(
  metadata: OfflineContentMetadata,
): Promise<void> {
  if (!isNative()) return;

  await ensureDir(metadata.contentId);

  await Filesystem.writeFile({
    path: `${contentDir(metadata.contentId)}/${metadataFileName()}`,
    data: JSON.stringify(metadata),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
}

/**
 * Read metadata for a downloaded content.
 */
export async function getContentMetadata(
  contentId: string,
): Promise<OfflineContentMetadata | null> {
  if (!isNative()) return null;

  try {
    const result = await Filesystem.readFile({
      path: `${contentDir(contentId)}/${metadataFileName()}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string) as OfflineContentMetadata;
  } catch {
    return null;
  }
}

/**
 * Get a local file URI for a segment (for use with PDF.js).
 */
export async function getLocalSegmentUri(
  contentId: string,
  segmentIndex: number,
): Promise<string | null> {
  if (!isNative()) return null;

  try {
    const result = await Filesystem.getUri({
      path: `${contentDir(contentId)}/${segmentFileName(segmentIndex)}`,
      directory: Directory.Data,
    });
    // Convert to a URI that WebView can load
    return Capacitor.convertFileSrc(result.uri);
  } catch {
    return null;
  }
}

/**
 * Check if a specific segment exists locally.
 */
export async function hasLocalSegment(
  contentId: string,
  segmentIndex: number,
): Promise<boolean> {
  if (!isNative()) return false;

  try {
    await Filesystem.stat({
      path: `${contentDir(contentId)}/${segmentFileName(segmentIndex)}`,
      directory: Directory.Data,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if all segments for a content are downloaded.
 */
export async function isContentFullyDownloaded(
  contentId: string,
): Promise<boolean> {
  if (!isNative()) return false;

  const metadata = await getContentMetadata(contentId);
  if (!metadata) return false;

  for (const seg of metadata.segments) {
    const exists = await hasLocalSegment(contentId, seg.index);
    if (!exists) return false;
  }
  return true;
}

/**
 * Delete all locally cached files for a content.
 */
export async function deleteContentCache(contentId: string): Promise<void> {
  if (!isNative()) return;

  try {
    await Filesystem.rmdir({
      path: contentDir(contentId),
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // Directory may not exist
  }
}

/**
 * Get list of all downloaded content IDs by listing the base directory.
 */
export async function getDownloadedContentIds(): Promise<string[]> {
  if (!isNative()) return [];

  try {
    // Ensure base dir exists
    try {
      await Filesystem.mkdir({
        path: BASE_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // exists
    }

    const result = await Filesystem.readdir({
      path: BASE_DIR,
      directory: Directory.Data,
    });

    const ids: string[] = [];
    for (const entry of result.files) {
      if (entry.type === 'directory') {
        // Verify it has metadata (is a valid download)
        const meta = await getContentMetadata(entry.name);
        if (meta) {
          ids.push(entry.name);
        }
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Convert a Blob to a base64 string (without the data URL prefix).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remove "data:application/pdf;base64," prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
