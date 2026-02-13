import { registerPlugin } from '@capacitor/core';
import type { EncryptedPdfViewerPlugin } from './definitions';

const EncryptedPdfViewer = registerPlugin<EncryptedPdfViewerPlugin>(
  'EncryptedPdfViewer',
  {
    web: () => import('./web').then((m) => new m.EncryptedPdfViewerWeb()),
  },
);

export * from './definitions';
export { EncryptedPdfViewer };
