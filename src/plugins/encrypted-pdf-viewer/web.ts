import { WebPlugin } from '@capacitor/core';
import type { EncryptedPdfViewerPlugin } from './definitions';

/**
 * Web fallback: renders the PDF in a full-screen iframe using a blob URL.
 * For development/preview only — native platforms use the Android plugin.
 */
export class EncryptedPdfViewerWeb
  extends WebPlugin
  implements EncryptedPdfViewerPlugin
{
  private container: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;

  async openPdf(options: {
    pdfBase64: string;
    title: string;
    initialPage?: number;
  }): Promise<{ lastPage: number }> {
    // Convert base64 → blob
    const binary = atob(options.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Create viewer overlay
    this.container = document.createElement('div');
    this.container.id = 'encrypted-pdf-viewer-overlay';
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      flexDirection: 'column',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: '#111',
      color: '#fff',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
    });
    header.innerHTML = `<span>${options.title}</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: '1px solid #555',
      color: '#fff',
      padding: '4px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '13px',
    });
    closeBtn.onclick = () => this.closePdf();
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    // Iframe
    this.iframe = document.createElement('iframe');
    this.iframe.src = `${url}#page=${options.initialPage || 1}`;
    Object.assign(this.iframe.style, {
      flex: '1',
      border: 'none',
      width: '100%',
    });
    this.container.appendChild(this.iframe);

    document.body.appendChild(this.container);

    // Return a promise that resolves when closed
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (!document.getElementById('encrypted-pdf-viewer-overlay')) {
          observer.disconnect();
          URL.revokeObjectURL(url);
          resolve({ lastPage: options.initialPage || 1 });
        }
      });
      observer.observe(document.body, { childList: true });
    });
  }

  async closePdf(): Promise<void> {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.iframe = null;
  }
}
