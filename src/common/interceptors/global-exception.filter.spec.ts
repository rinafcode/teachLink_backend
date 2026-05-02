import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import { runWithCorrelationId } from '../utils/correlation.utils';
describe('GlobalExceptionFilter', () => {
    it('adds correlation ID to error response and header', () => {
        const filter = new GlobalExceptionFilter();
        const req: unknown = { method: 'GET', url: '/test' };
        const responseHeaders: Record<string, string> = {};
        const res: unknown = {
            status: (code: number) => {
                res.statusCode = code;
                return res;
            },
            json: (body: unknown) => {
                res.body = body;
                return res;
            },
            setHeader: (name: string, value: string) => {
                responseHeaders[name.toLowerCase()] = value;
            },
            getHeader: (name: string) => responseHeaders[name.toLowerCase()],
        };
        runWithCorrelationId(() => {
            filter.catch(new Error('Test error'), {
                switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
            } as unknown);
        }, 'cid-123');
        const body = res.body;
        expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(body.correlationId).toBe('cid-123');
        expect(body.message).toBe('Test error');
    });
    it('maps Multer file size errors to payload too large', () => {
        const filter = new GlobalExceptionFilter();
        const req: unknown = { method: 'POST', url: '/media/upload' };
        const res: unknown = {
            status: (code: number) => {
                res.statusCode = code;
                return res;
            },
            json: (body: unknown) => {
                res.body = body;
                return res;
            },
            setHeader: jest.fn(),
        };
        filter.catch(new MulterError('LIMIT_FILE_SIZE', 'file'), {
            switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
        } as unknown);
        expect(res.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
        expect(res.body.message).toBe('Uploaded file exceeds the maximum allowed size.');
    });
});
