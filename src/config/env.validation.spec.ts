import { envValidationSchema } from './env.validation';

const validEnv = {
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'teachlink',
  DATABASE_PASSWORD: 'password',
  DATABASE_NAME: 'teachlink',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_SECRET: 'a-very-secret-jwt-key',
  JWT_REFRESH_SECRET: 'a-very-secret-refresh-key',
  ENCRYPTION_SECRET: 'a'.repeat(32),
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  EMAIL_FROM: 'noreply@example.com',
  AWS_ACCESS_KEY_ID: 'AKIA123',
  AWS_SECRET_ACCESS_KEY: 'secret',
  AWS_S3_BUCKET: 'teachlink-bucket',
  SENDGRID_API_KEY: 'SG.123',
  SENDGRID_SENDER_EMAIL: 'sender@example.com',
  SENDGRID_WEBHOOK_TOKEN: 'token',
  SESSION_SECRET: 'a-very-secret-session-key',
  REGION: 'us-east-1',
  REPLICATION_REGIONS: 'us-east-1,us-west-2',
};

function validate(env: Record<string, string | undefined>) {
  return envValidationSchema.validate(env, { abortEarly: false });
}

describe('envValidationSchema', () => {
  it('passes validation when all required vars are present and valid', () => {
    const { error } = validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('fails startup when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...envWithoutSecret } = validEnv;
    const { error } = validate(envWithoutSecret);

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_SECRET');
  });

  it('lists every missing required var in a single descriptive error', () => {
    const { error } = validate({});

    expect(error).toBeDefined();
    const messages = error?.details.map((d) => d.message).join('\n') ?? '';
    expect(messages).toContain('DATABASE_HOST');
    expect(messages).toContain('REDIS_HOST');
    expect(messages).toContain('JWT_REFRESH_SECRET');
    expect(messages).toContain('ENCRYPTION_SECRET');
  });

  it('fails validation when ENCRYPTION_SECRET is shorter than 32 characters', () => {
    const { error } = validate({ ...validEnv, ENCRYPTION_SECRET: 'too-short' });

    expect(error).toBeDefined();
    expect(error?.message).toContain('ENCRYPTION_SECRET');
  });

  it('allows JWT_SECRET to be omitted when JWT_SECRETS (rotation list) is set', () => {
    const { JWT_SECRET, ...rest } = validEnv;
    const { error } = validate({ ...rest, JWT_SECRETS: 'v1:secret-one,v2:secret-two' });

    expect(error).toBeUndefined();
  });

  describe('BCRYPT_ROUNDS validation', () => {
    it('defaults BCRYPT_ROUNDS to 12 when omitted', () => {
      const { value, error } = validate(validEnv);
      expect(error).toBeUndefined();
      expect(value.BCRYPT_ROUNDS).toBe(12);
    });

    it('accepts BCRYPT_ROUNDS values between 10 and 14', () => {
      for (const rounds of [10, 12, 14]) {
        const { value, error } = validate({ ...validEnv, BCRYPT_ROUNDS: String(rounds) });
        expect(error).toBeUndefined();
        expect(value.BCRYPT_ROUNDS).toBe(rounds);
      }
    });

    it('rejects BCRYPT_ROUNDS values below 10', () => {
      const { error } = validate({ ...validEnv, BCRYPT_ROUNDS: '9' });
      expect(error).toBeDefined();
      expect(error?.message).toContain('BCRYPT_ROUNDS');
    });

    it('rejects BCRYPT_ROUNDS values above 14', () => {
      const { error } = validate({ ...validEnv, BCRYPT_ROUNDS: '15' });
      expect(error).toBeDefined();
      expect(error?.message).toContain('BCRYPT_ROUNDS');
    });
  });

  describe('DATABASE_SYNCHRONIZE validation', () => {
    it('defaults DATABASE_SYNCHRONIZE to false when omitted', () => {
      const { value, error } = validate(validEnv);
      expect(error).toBeUndefined();
      expect(value.DATABASE_SYNCHRONIZE).toBe(false);
    });

    it('accepts boolean values for DATABASE_SYNCHRONIZE', () => {
      const { value, error } = validate({ ...validEnv, DATABASE_SYNCHRONIZE: 'true' });
      expect(error).toBeUndefined();
      expect(value.DATABASE_SYNCHRONIZE).toBe(true);
    });
  });
});
