import { FILE_SIZE_LIMITS, ALL_ALLOWED_FILE_TYPES, MAX_UPLOAD_FILE_SIZE, } from './file-validation.constants';
export interface UploadValidationRequestLike {
    uploadValidationError?: {
        message: string;
        allowedMimeTypes: string[];
    };
}
export interface UploadValidationFileLike {
    mimetype?: string;
}
export interface UploadFilterCallback {
    (error: Error | null, acceptFile: boolean): void;
}
export const MEDIA_UPLOAD_INTERCEPTOR_OPTIONS = {
    limits: {
        fileSize: MAX_UPLOAD_FILE_SIZE,
        files: 1,
    },
    fileFilter: (req: UploadValidationRequestLike, file: UploadValidationFileLike, callback: UploadFilterCallback): void => {
        const allowedMimeTypes = ALL_ALLOWED_FILE_TYPES as readonly string[];
        const normalizedMimeType = file.mimetype?.toLowerCase().trim() || '';
        if (!allowedMimeTypes.includes(normalizedMimeType)) {
            req.uploadValidationError = {
                message: `File type "${file.mimetype || 'unknown'}" is not allowed`,
                allowedMimeTypes: ALL_ALLOWED_FILE_TYPES,
            };
            callback(null, false);
            return;
        }
        callback(null, true);
    },
} as const;
export function buildUploadValidationDetails() {
    return {
        allowedTypes: ALL_ALLOWED_FILE_TYPES,
        sizeLimits: FILE_SIZE_LIMITS,
        maxUploadSize: MAX_UPLOAD_FILE_SIZE,
    };
}
