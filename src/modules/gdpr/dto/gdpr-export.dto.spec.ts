import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GdprExportDto } from './gdpr-export.dto';

describe('GdprExportDto', () => {
  it('accepts an empty payload (all optional)', async () => {
    const dto = plainToInstance(GdprExportDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts payload with optional fields set', async () => {
    const dto = plainToInstance(GdprExportDto, {
      password: 'secret',
      refreshToken: 'token-123',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      token: 'jwt-token',
      passwordHistory: ['old-pass-1', 'old-pass-2'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
