/**
 * TypeScript bridge for the native Android NativeDownloaderPlugin.
 * On web/iOS, these methods are no-ops — the existing fetch() fallback is used instead.
 */

import { registerPlugin } from '@capacitor/core';

export interface DownloadFileOptions {
    url: string;
    filePath: string;
}

export interface DownloadFileResult {
    path: string;
    size: number;
}

export interface DownloadProgressEvent {
    progress: number;
    downloadedBytes: number;
    totalBytes: number;
}

export interface StartForegroundOptions {
    title: string;
    totalSegments: number;
}

export interface UpdateProgressOptions {
    currentSegment: number;
    totalSegments: number;
    overallProgress: number;
}

export interface StopForegroundOptions {
    title: string;
    success: boolean;
}

export interface NativeDownloaderPluginInterface {
    downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult>;
    startForegroundDownload(options: StartForegroundOptions): Promise<void>;
    updateDownloadProgress(options: UpdateProgressOptions): Promise<void>;
    stopForegroundDownload(options: StopForegroundOptions): Promise<void>;
    addListener(
        eventName: 'downloadProgress',
        listenerFunc: (event: DownloadProgressEvent) => void,
    ): Promise<{ remove: () => Promise<void> }>;
}

export const NativeDownloader = registerPlugin<NativeDownloaderPluginInterface>('NativeDownloader');
