import { cloudinary } from '../../config/cloudinary';
import { AppError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';

export interface UploadedFile {
  publicId: string;
  url: string;
}

/**
 * Uploads a resume buffer to Cloudinary as a "raw" resource (PDFs/DOCX aren't
 * images, so Cloudinary's image pipeline doesn't apply). Scoped under
 * `resumes/{userId}/` so a user's files are grouped and easy to audit/purge.
 */
export function uploadResumeFile(buffer: Buffer, userId: string, originalFilename: string): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: `resumes/${userId}`,
        filename_override: originalFilename,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          logger.error('Cloudinary upload failed', { err: error?.message });
          reject(
            AppError.badRequest('Could not store the uploaded file. Please try again.', 'STORAGE_UPLOAD_FAILED')
          );
          return;
        }
        resolve({ publicId: result.public_id, url: result.secure_url });
      }
    );

    uploadStream.end(buffer);
  });
}

export async function deleteResumeFile(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch (err) {
    // Non-fatal: the DB row is the source of truth for the user; an orphaned
    // Cloudinary asset is a cost/cleanup concern, not a correctness one.
    logger.error('Cloudinary delete failed', {
      publicId,
      err: err instanceof Error ? err.message : err,
    });
  }
}
