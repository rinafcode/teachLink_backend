import { IsString } from 'class-validator';

/**
 * Body for `POST /auth/verify-email`.
 *
 * Issue #801 — `token` is the RAW verification token emailed on signup.
 * The server hashes it (SHA-256) and looks up the matching row.
 */
export class VerifyEmailDto {
  @IsString()
  token: string;
}
