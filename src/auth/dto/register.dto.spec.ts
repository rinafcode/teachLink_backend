import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

function buildValid(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return plainToInstance(RegisterDto, {
    firstName: 'Jane',
    lastName: 'Doe',
    username: 'janedoe42',
    email: 'jane@example.com',
    password: 'Secure@123',
    ...overrides,
  });
}

async function errorsFor(overrides: Partial<RegisterDto>) {
  const errors = await validate(buildValid(overrides));
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('RegisterDto – firstName / lastName validation', () => {
  it('passes with valid names', async () => {
    const errors = await validate(buildValid());
    expect(errors).toHaveLength(0);
  });

  // firstName
  it('rejects empty firstName', async () => {
    const messages = await errorsFor({ firstName: '' });
    expect(messages.some((m) => /first name is required/i.test(m))).toBe(true);
  });

  it('rejects whitespace-only firstName', async () => {
    const messages = await errorsFor({ firstName: '   ' });
    expect(messages.some((m) => /first name is required/i.test(m))).toBe(true);
  });

  it('rejects firstName exceeding 50 characters', async () => {
    const messages = await errorsFor({ firstName: 'A'.repeat(51) });
    expect(messages.some((m) => /first name cannot exceed/i.test(m))).toBe(true);
  });

  it('accepts firstName exactly 50 characters', async () => {
    const messages = await errorsFor({ firstName: 'A'.repeat(50) });
    expect(messages.some((m) => /first name/i.test(m))).toBe(false);
  });

  it('trims leading/trailing whitespace from firstName', () => {
    const dto = buildValid({ firstName: '  Jane  ' });
    expect(dto.firstName).toBe('Jane');
  });

  // lastName
  it('rejects empty lastName', async () => {
    const messages = await errorsFor({ lastName: '' });
    expect(messages.some((m) => /last name is required/i.test(m))).toBe(true);
  });

  it('rejects whitespace-only lastName', async () => {
    const messages = await errorsFor({ lastName: '   ' });
    expect(messages.some((m) => /last name is required/i.test(m))).toBe(true);
  });

  it('rejects lastName exceeding 50 characters', async () => {
    const messages = await errorsFor({ lastName: 'B'.repeat(51) });
    expect(messages.some((m) => /last name cannot exceed/i.test(m))).toBe(true);
  });

  it('accepts lastName exactly 50 characters', async () => {
    const messages = await errorsFor({ lastName: 'B'.repeat(50) });
    expect(messages.some((m) => /last name/i.test(m))).toBe(false);
  });

  it('trims leading/trailing whitespace from lastName', () => {
    const dto = buildValid({ lastName: '  Doe  ' });
    expect(dto.lastName).toBe('Doe');
  });
});
