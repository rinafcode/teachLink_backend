import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('should be defined', () => {
    const dto = plainToInstance(RegisterDto, {});
    expect(dto).toBeDefined();
  });

  it('rejects an empty registration', async () => {
    const errors = await validate(plainToInstance(RegisterDto, {}));
    expect(errors.length).toBeGreaterThan(0);
  });
});
