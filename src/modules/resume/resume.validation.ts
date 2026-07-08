import { AppError } from '../../common/errors/AppError';

export const SUPPORTED_MIME_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export type ResumeMimeType = (typeof SUPPORTED_MIME_TYPES)[keyof typeof SUPPORTED_MIME_TYPES];

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
// DOCX is a zip archive; every zip starts with the "local file header" signature PK\x03\x04.
const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Never trust the client-declared mimetype or file extension - both are
 * trivially spoofable. This inspects the actual leading bytes of the file.
 */
function detectRealFileType(buffer: Buffer): 'pdf' | 'docx-zip' | 'unknown' {
  if (buffer.length < 4) return 'unknown';
  if (buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)) return 'pdf';
  if (buffer.subarray(0, 4).equals(ZIP_MAGIC_BYTES)) return 'docx-zip';
  return 'unknown';
}

/**
 * Validates an uploaded resume file end-to-end: size, declared MIME type,
 * and actual magic bytes. Throws AppError with a user-facing message on
 * any mismatch - never trusts the extension or the client's Content-Type.
 */
export function validateResumeFile(file: { buffer: Buffer; mimetype: string; size: number }): {
  mimeType: ResumeMimeType;
} {
  if (file.size === 0) {
    throw AppError.badRequest('Uploaded file is empty', 'EMPTY_FILE');
  }

  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw AppError.badRequest(
      `File exceeds the ${MAX_RESUME_FILE_SIZE_BYTES / (1024 * 1024)}MB size limit`,
      'FILE_TOO_LARGE'
    );
  }

  const declaredIsPdf = file.mimetype === SUPPORTED_MIME_TYPES.PDF;
  const declaredIsDocx = file.mimetype === SUPPORTED_MIME_TYPES.DOCX;

  if (!declaredIsPdf && !declaredIsDocx) {
    throw AppError.badRequest(
      'Only PDF and DOCX resumes are supported',
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  const realType = detectRealFileType(file.buffer);

  if (declaredIsPdf && realType !== 'pdf') {
    throw AppError.badRequest(
      'File content does not match a valid PDF (failed magic-byte check)',
      'CORRUPT_OR_SPOOFED_FILE'
    );
  }

  // DOCX files are zip containers, so we can only confirm "this is a zip",
  // not "this is specifically a DOCX" from magic bytes alone. Genuine
  // corruption/mismatch is caught later when mammoth fails to parse it.
  if (declaredIsDocx && realType !== 'docx-zip') {
    throw AppError.badRequest(
      'File content does not match a valid DOCX (failed magic-byte check)',
      'CORRUPT_OR_SPOOFED_FILE'
    );
  }

  return { mimeType: file.mimetype as ResumeMimeType };
}
