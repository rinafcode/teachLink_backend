import { buildUploadValidationDetails, MEDIA_UPLOAD_INTERCEPTOR_OPTIONS, } from './upload-validation.util';
import { ALL_ALLOWED_FILE_TYPES, MAX_UPLOAD_FILE_SIZE } from './file-validation.constants';
describe('upload validation util', () => {
    it('accepts files with whitelisted MIME types', () => {
        const callback = jest.fn();
        const req: Record<string, unknown> = {};
        MEDIA_UPLOAD_INTERCEPTOR_OPTIONS.fileFilter(req, { mimetype: ALL_ALLOWED_FILE_TYPES[0] }, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
        expect(req).not.toHaveProperty('uploadValidationError');
    });
    it('rejects files with non-whitelisted MIME types', () => {
        const callback = jest.fn();
        const req: Record<string, unknown> = {};
        MEDIA_UPLOAD_INTERCEPTOR_OPTIONS.fileFilter(req, { mimetype: 'application/x-msdownload' }, callback);
        expect(callback).toHaveBeenCalledWith(null, false);
        expect(req).toHaveProperty('uploadValidationError');
        expect(req['uploadValidationError']).toMatchObject({
            message: 'File type "application/x-msdownload" is not allowed',
        });
    });
    it('exposes upload validation details for API responses', () => {
        expect(buildUploadValidationDetails()).toMatchObject({
            allowedTypes: ALL_ALLOWED_FILE_TYPES,
            maxUploadSize: MAX_UPLOAD_FILE_SIZE,
        });
    });
});
