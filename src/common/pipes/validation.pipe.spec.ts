import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { createValidationPipe } from './validation.pipe';
import { RegisterDto } from '../../auth/dto/auth.dto';

// Minimal DTO for pipe behaviour tests
class SampleDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  name: string;
}

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });
});

describe('RegisterDto validation', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(RegisterDto, plain);
    return validate(dto);
  }

  it('passes with valid input', async () => {
    const errors = await validateDto({
      email: 'user@example.com',
      password: 'Secret1pass',
      confirmPassword: 'Secret1pass',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid email', async () => {
    const errors = await validateDto({
      email: 'not-an-email',
      password: 'Secret1pass',
      confirmPassword: 'Secret1pass',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('fails when password is too short', async () => {
    const errors = await validateDto({
      email: 'user@example.com',
      password: 'Sh0rt',
      confirmPassword: 'Sh0rt',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('fails when passwords do not match', async () => {
    const errors = await validateDto({
      email: 'user@example.com',
      password: 'Secret1pass',
      confirmPassword: 'Different1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(errors.some((e) => e.property === 'confirmPassword')).toBe(true);
  });

  it('fails when password lacks uppercase letter', async () => {
    const errors = await validateDto({
      email: 'user@example.com',
      password: 'alllower1',
      confirmPassword: 'alllower1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('fails with missing required fields', async () => {
    const errors = await validateDto({});
    expect(errors.length).toBeGreaterThan(0);
  });
});