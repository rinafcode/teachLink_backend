import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

/**
 * Body for `POST /auth/forgot-password`.
 *
 * Issue #801 — the response includes a SHA-256 hashed token in the DB;
 * the raw value (returned ONLY in dev mode via `EXPOSE_RESET_TOKENS=true`)
 * is what the email-service worker sends to the user. Nobody else ever
 * sees the raw value.
 */
export class ForgotPasswordDto {
  @Transform(({ value }) => value?.toLowerCase?.() ?? value)
  @IsEmail()
  email: string;
}
