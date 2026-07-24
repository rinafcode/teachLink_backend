import { IsString, MinLength } from 'class-validator';

/**
 * Body for `POST /auth/reset-password`.
 *
 * Issue #801 — `token` is the RAW reset token emailed to the user.
 * The server hashes it (SHA-256) and looks up the matching row; the
 * raw value never reaches the database.
 */
export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
