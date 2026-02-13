export interface EncryptedPdfViewerPlugin {
  /**
   * Open the native PDF viewer with decrypted PDF bytes.
   * On Android, uses PdfRenderer in a secure activity (FLAG_SECURE).
   * The bytes are never written to disk.
   */
  openPdf(options: {
    /** Base64-encoded decrypted PDF bytes */
    pdfBase64: string;
    /** Title to display in the viewer */
    title: string;
    /** Initial page to display (1-indexed) */
    initialPage?: number;
  }): Promise<{ lastPage: number }>;

  /**
   * Close the native PDF viewer if open.
   */
  closePdf(): Promise<void>;
}
