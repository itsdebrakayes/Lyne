/**
 * text-reader — on-device text recognition for an image or a PDF.
 *
 * Apple Vision on iOS, Google ML Kit (bundled model, works offline) on Android.
 * The document never leaves the phone: the privacy labels and the reviewer
 * notes both say ID images are not uploaded, and this keeps that true.
 *
 * Both functions resolve to the recognised lines of text, top to bottom, and
 * reject only when the file cannot be opened. Finding a TRN in those lines is
 * the caller's job (lib/trn.ts), so it can be tested without a device.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

interface TextReaderNative {
  readImage(uri: string): Promise<string[]>;
  readPdf(uri: string, maxPages: number): Promise<string[]>;
}

/* Optional, not required: on the web build (used by the Playwright suite) and
   in any binary built without the module, importing it must not take the whole
   app down. Without it there is simply no text, and the capture screen falls
   back to its "type it in" path. */
const native = requireOptionalNativeModule<TextReaderNative>('TextReader');

/** False where the native reader is absent (web). */
export const isTextReaderAvailable = native !== null;

export function readImageText(uri: string): Promise<string[]> {
  return native ? native.readImage(uri) : Promise.resolve([]);
}

/** Reads the PDF's own text where it has some, and renders and recognises the page where it does not (a scan). */
export function readPdfText(uri: string, maxPages = 3): Promise<string[]> {
  return native ? native.readPdf(uri, maxPages) : Promise.resolve([]);
}
