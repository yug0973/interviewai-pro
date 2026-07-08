import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { logger } from '../../common/logger';
import { AppError } from '../../common/errors/AppError';
import { SUPPORTED_MIME_TYPES, type ResumeMimeType } from './resume.validation';

/** Below this many characters, a "successful" PDF text extraction is treated as empty/image-only. */
const MIN_VIABLE_TEXT_LENGTH = 40;

/** Resumes rarely exceed this many pages; caps OCR cost/time on pathological uploads. */
const MAX_OCR_PAGES = 5;

/** Cached locally after first download so OCR doesn't re-fetch language data every run. */
const TESSERACT_CACHE_PATH = path.resolve(process.cwd(), '.tesseract-cache');

export type ExtractionMethod = 'text' | 'ocr';

export interface FastExtractionResult {
  /** Present when method is 'text'; null when method is 'ocr' and OCR hasn't run yet. */
  text: string | null;
  method: ExtractionMethod;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } catch (err) {
    throw AppError.badRequest(
      'This PDF could not be read - it may be corrupted or password-protected',
      'CORRUPT_PDF'
    );
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (err) {
    throw AppError.badRequest(
      'This DOCX file could not be read - it may be corrupted',
      'CORRUPT_DOCX'
    );
  }
}

/**
 * Renders the first MAX_OCR_PAGES pages of a PDF to PNGs and OCRs each one.
 * Used only when direct text extraction comes back empty/near-empty, i.e.
 * the PDF is a scanned image with no embedded text layer. Genuinely slow
 * (multiple seconds per page, more on a cold cache) - the caller MUST run
 * this in the background worker, never inline in an HTTP request.
 */
export async function ocrPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  let screenshots;
  try {
    screenshots = await parser.getScreenshot({ scale: 2, first: MAX_OCR_PAGES });
  } catch (err) {
    throw AppError.badRequest(
      'This PDF could not be rendered for OCR - it may be corrupted',
      'CORRUPT_PDF'
    );
  } finally {
    await parser.destroy();
  }

  const worker = await createWorker('eng', 1, { cachePath: TESSERACT_CACHE_PATH });

  try {
    const pageTexts: string[] = [];
    for (const page of screenshots.pages) {
      const { data } = await worker.recognize(page.data);
      pageTexts.push(data.text.trim());
    }
    return pageTexts.join('\n\n').trim();
  } catch (err) {
    logger.error('OCR recognition failed', { err: err instanceof Error ? err.message : err });
    throw AppError.badRequest(
      'Text could not be extracted from this resume, even via OCR. Please upload a clearer scan or a text-based PDF/DOCX.',
      'OCR_FAILED'
    );
  } finally {
    await worker.terminate();
  }
}

/**
 * Runs ONLY the fast, direct text-layer extraction - never OCR. Used inline
 * in the upload request so the response comes back quickly regardless of
 * file type. When a PDF has no usable text layer, this returns
 * `{ text: null, method: 'ocr' }` as a signal that OCR is needed; the caller
 * is responsible for enqueueing that OCR pass to run in the background
 * worker (see resume-analysis.worker.ts) rather than blocking on it here.
 */
export async function extractResumeTextFast(
  buffer: Buffer,
  mimeType: ResumeMimeType
): Promise<FastExtractionResult> {
  if (mimeType === SUPPORTED_MIME_TYPES.DOCX) {
    const text = await extractDocxText(buffer);
    if (text.length < MIN_VIABLE_TEXT_LENGTH) {
      throw AppError.badRequest(
        'This DOCX file appears to contain little to no readable text',
        'EMPTY_EXTRACTION'
      );
    }
    return { text, method: 'text' };
  }

  const directText = await extractPdfText(buffer);
  if (directText.length >= MIN_VIABLE_TEXT_LENGTH) {
    return { text: directText, method: 'text' };
  }

  logger.info('PDF text layer empty/too short - will OCR in the background worker', {
    directTextLength: directText.length,
  });

  return { text: null, method: 'ocr' };
}