import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { PaginationQueryDto, CursorPaginationQueryDto } from './pagination.dto';
import { APP_CONSTANTS } from '../constants/app.constants';
describe('Pagination DTO validation', () => {
    const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = APP_CONSTANTS;
    it('uses the default page size when no limit is provided', () => {
        const dto = new PaginationQueryDto();
        const errors = validateSync(dto);
        expect(errors).toHaveLength(0);
        expect(dto.limit).toBe(DEFAULT_PAGE_SIZE);
    });
    it('accepts a limit equal to the maximum page size', () => {
        const dto = new PaginationQueryDto();
        dto.limit = MAX_PAGE_SIZE;
        const errors = validateSync(dto);
        expect(errors).toHaveLength(0);
    });
    it('rejects a limit greater than the maximum page size', () => {
        const dto = new PaginationQueryDto();
        dto.limit = MAX_PAGE_SIZE + 1;
        const errors = validateSync(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints).toHaveProperty('max');
    });
    it('validates cursor pagination limit against the same maximum', () => {
        const dto = new CursorPaginationQueryDto();
        dto.limit = MAX_PAGE_SIZE + 1;
        const errors = validateSync(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints).toHaveProperty('max');
    });
});
