import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

// ---------------------------------------------------------------------------
// LoginDto
// ---------------------------------------------------------------------------
describe('LoginDto', () => {
  const valid = { email: 'user@teachlink.xyz', password: 'Secure@123' };

  it('accepts valid credentials', async () => {
    const errors = await validate(plainToInstance(LoginDto, valid));
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    const errors = await validate(plainToInstance(LoginDto, { password: valid.password }));
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an invalid email format', async () => {
    const errors = await validate(plainToInstance(LoginDto, { ...valid, email: 'not-an-email' }));
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('normalises email to lowercase', () => {
    const instance = plainToInstance(LoginDto, { ...valid, email: 'USER@TEACHLINK.XYZ' });
    expect(instance.email).toBe('user@teachlink.xyz');
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validate(plainToInstance(LoginDto, { ...valid, password: 'Ab@1' }));
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a missing password', async () => {
    const errors = await validate(plainToInstance(LoginDto, { email: valid.email }));
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RegisterDto
// ---------------------------------------------------------------------------
describe('RegisterDto', () => {
  const valid = {
    username: 'technocrat42',
    email: 'user@teachlink.xyz',
    password: 'Secure@123',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('accepts a minimal valid registration', async () => {
    const errors = await validate(plainToInstance(RegisterDto, valid));
    expect(errors).toHaveLength(0);
  });

  it('accepts optional displayName and avatarUrl', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        ...valid,
        displayName: 'Tech Guru',
        avatarUrl: 'https://cdn.teachlink.xyz/avatar.png',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  // username
  it('rejects a username shorter than 3 characters', async () => {
    const errors = await validate(plainToInstance(RegisterDto, { ...valid, username: 'ab' }));
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('rejects a username longer than 30 characters', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, username: 'a'.repeat(31) }),
    );
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('rejects a username with spaces or special characters', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, username: 'user name!' }),
    );
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('accepts a username with underscores and hyphens', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, username: 'tech-user_1' }),
    );
    expect(errors).toHaveLength(0);
  });

  // email
  it('rejects an invalid email', async () => {
    const errors = await validate(plainToInstance(RegisterDto, { ...valid, email: 'bad' }));
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('normalises email to lowercase', () => {
    const instance = plainToInstance(RegisterDto, { ...valid, email: 'USER@TEACHLINK.XYZ' });
    expect(instance.email).toBe('user@teachlink.xyz');
  });

  // password complexity
  it('rejects a password with no uppercase letter', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, password: 'secure@123' }),
    );
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password with no special character', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, password: 'Secure123' }),
    );
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password with no digit', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, password: 'Secure@abc' }),
    );
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validate(plainToInstance(RegisterDto, { ...valid, password: 'A@1b' }));
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  // optional fields
  it('rejects an invalid avatarUrl', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, avatarUrl: 'not-a-url' }),
    );
    expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
  });

  it('rejects a displayName longer than 60 characters', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, displayName: 'x'.repeat(61) }),
    );
    expect(errors.some((e) => e.property === 'displayName')).toBe(true);
  });

  // required fields
  it('requires username, email, and password', async () => {
    const errors = await validate(plainToInstance(RegisterDto, {}));
    const props = errors.map((e) => e.property);
    expect(props).toContain('username');
    expect(props).toContain('email');
    expect(props).toContain('password');
  });
});
